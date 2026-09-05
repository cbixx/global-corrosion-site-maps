import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";


let currentViewer = null;


/* ============================================================
   BASIC HELPERS
   ============================================================ */

function categoricalColor(value) {

  const text =
    String(
      value ??
      "undefined"
    );


  let hash = 0;


  for (
    let i = 0;
    i < text.length;
    i += 1
  ) {

    hash =
      (
        (hash << 5) -
        hash +
        text.charCodeAt(i)
      ) | 0;

  }


  const normalized =
    (
      Math.abs(hash) *
      0.61803398875
    ) % 1;


  const color =
    new THREE.Color();


  color.setHSL(
    normalized,
    0.46,
    0.58
  );


  return color;
}

const ELEMENT_COLORS = {

  shell:
    new THREE.Color(
      "#477b9d"
    ),

  solid:
    new THREE.Color(
      "#8a7255"
    ),

  beam:
    new THREE.Color(
      "#577a64"
    ),

  other:
    new THREE.Color(
      "#777777"
    )

};


const SELECTION_COLOR =
  new THREE.Color(
    "#c55f2a"
  );


function nodeIndex(nodeMap, nodeId) {
  const index = nodeMap.get(nodeId);

  return Number.isInteger(index)
    ? index
    : null;
}


function pushTriangle(target, a, b, c) {
  if (
    a === null ||
    b === null ||
    c === null
  ) {
    return;
  }

  target.push(a, b, c);
}


function pushQuad(target, a, b, c, d) {
  if (
    a === null ||
    b === null ||
    c === null ||
    d === null
  ) {
    return;
  }

  target.push(
    a, b, c,
    a, c, d
  );
}


/* ============================================================
   SHELL SURFACE
   ============================================================ */

function shellIndices(connectivity, nodeMap) {
  const indices = [];

  for (
    let i = 0;
    i + 3 < connectivity.length;
    i += 4
  ) {

    const n1 = connectivity[i];
    const n2 = connectivity[i + 1];
    const n3 = connectivity[i + 2];
    const n4 = connectivity[i + 3];

    const a = nodeIndex(nodeMap, n1);
    const b = nodeIndex(nodeMap, n2);
    const c = nodeIndex(nodeMap, n3);

    /*
     * LS-DYNA triangular shell elements are often
     * represented by repeating N3 as N4.
     */
    if (
      n4 === null ||
      n4 === undefined ||
      n4 === 0 ||
      n4 === n3
    ) {

      pushTriangle(
        indices,
        a,
        b,
        c
      );

      continue;
    }

    const d = nodeIndex(
      nodeMap,
      n4
    );

    pushQuad(
      indices,
      a,
      b,
      c,
      d
    );
  }

  return new Uint32Array(indices);
}


/* ============================================================
   SOLID SURFACE
   ============================================================ */

function solidIndices(connectivity, nodeMap) {
  const indices = [];

  for (
    let i = 0;
    i + 7 < connectivity.length;
    i += 8
  ) {

    const ids = connectivity.slice(
      i,
      i + 8
    );

    const n = ids.map(
      (id) => nodeIndex(nodeMap, id)
    );

    if (
      n.some((value) => value === null)
    ) {
      continue;
    }

    const [
      n1,
      n2,
      n3,
      n4,
      n5,
      n6,
      n7,
      n8
    ] = n;


    /*
     * Six faces of a standard 8-node hexahedral element.
     *
     * Interior faces are deliberately retained in Batch 3.
     * Exterior-face extraction will be introduced during the
     * later performance optimisation batch.
     */

    pushQuad(
      indices,
      n1,
      n2,
      n3,
      n4
    );

    pushQuad(
      indices,
      n5,
      n8,
      n7,
      n6
    );

    pushQuad(
      indices,
      n1,
      n5,
      n6,
      n2
    );

    pushQuad(
      indices,
      n2,
      n6,
      n7,
      n3
    );

    pushQuad(
      indices,
      n3,
      n7,
      n8,
      n4
    );

    pushQuad(
      indices,
      n4,
      n8,
      n5,
      n1
    );
  }

  return new Uint32Array(indices);
}


/* ============================================================
   BEAMS
   ============================================================ */

function beamIndices(connectivity, nodeMap) {
  const indices = [];

  for (
    let i = 0;
    i + 1 < connectivity.length;
    i += 2
  ) {

    const a = nodeIndex(
      nodeMap,
      connectivity[i]
    );

    const b = nodeIndex(
      nodeMap,
      connectivity[i + 1]
    );

    if (
      a === null ||
      b === null
    ) {
      continue;
    }

    indices.push(
      a,
      b
    );
  }

  return new Uint32Array(indices);
}


/* ============================================================
   CAMERA FITTING
   ============================================================ */

function calculateModelBounds(group) {
  const box =
    new THREE.Box3()
      .setFromObject(group);

  if (box.isEmpty()) {
    return null;
  }

  const sphere =
    box.getBoundingSphere(
      new THREE.Sphere()
    );

  return {
    box,
    sphere
  };
}


function cameraDistanceForSphere(
  camera,
  radius
) {

  const verticalFov =
    THREE.MathUtils.degToRad(
      camera.fov
    );

  const horizontalFov =
    2 *
    Math.atan(
      Math.tan(verticalFov / 2) *
      camera.aspect
    );

  const limitingFov =
    Math.min(
      verticalFov,
      horizontalFov
    );

  return (
    radius /
    Math.sin(limitingFov / 2)
  ) * 1.25;
}


/* ============================================================
   VIEWER
   ============================================================ */

class LsdynaViewer {

  constructor(host, model, options = {}) {

    this.host = host;
    this.model = model;
    this.statusElement =
      options.statusElement || null;

    this.meshes = [];

    this.partObjects =
      new Map();


    this.partMetadata =
      options.partMetadata ||
      new Map();


    this.colorMode =
      options.colorMode ||
      "part";


    this.selectedPartId =
      options.selectedPartId !== null &&
      options.selectedPartId !== undefined
        ? String(
            options.selectedPartId
          )
        : null;


    this.onSelect =
      typeof options.onSelect ===
      "function"
        ? options.onSelect
        : null;


    this.partOpacity =
      new Map();


    this.raycaster =
      new THREE.Raycaster();


    this.pointer =
      new THREE.Vector2();


    this.pointerStart = null;

    this.kindVisibility = {
      shell: true,
      solid: true,
      beam: true
    };


    /* --------------------------------------------------------
       Scene
       -------------------------------------------------------- */

    this.scene =
      new THREE.Scene();

    this.scene.background =
      new THREE.Color("#f4f7f9");


    /* --------------------------------------------------------
       Camera
       -------------------------------------------------------- */

    this.camera =
      new THREE.PerspectiveCamera(
        38,
        1,
        0.01,
        1e9
      );


    /* --------------------------------------------------------
       Renderer
       -------------------------------------------------------- */

    this.renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
      });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        2
      )
    );

    this.renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    this.host.innerHTML = "";

    this.host.appendChild(
      this.renderer.domElement
    );


    /* --------------------------------------------------------
       Orbit controls
       -------------------------------------------------------- */

    this.controls =
      new OrbitControls(
        this.camera,
        this.renderer.domElement
      );

    this.controls.enableDamping = true;

    this.controls.dampingFactor = 0.08;

    this.controls.screenSpacePanning = true;


    /* --------------------------------------------------------
       Lighting
       -------------------------------------------------------- */

    const hemisphere =
      new THREE.HemisphereLight(
        0xffffff,
        0x536574,
        2.0
      );

    this.scene.add(
      hemisphere
    );


    const directional =
      new THREE.DirectionalLight(
        0xffffff,
        2.0
      );

    directional.position.set(
      1,
      -1,
      2
    );

    this.scene.add(
      directional
    );


    /* --------------------------------------------------------
       Model group
       -------------------------------------------------------- */

    this.modelGroup =
      new THREE.Group();

    this.scene.add(
      this.modelGroup
    );


    /* --------------------------------------------------------
       Axes
       -------------------------------------------------------- */

    this.axes =
      new THREE.AxesHelper(1);

    this.scene.add(
      this.axes
    );


    this.buildModel();

    this.bounds =
      calculateModelBounds(
        this.modelGroup
      );

    this.updateAxes();

    this.resize();

    this.setView("iso");


    /*
     * Batch 4:
     * enable clicking Parts in the 3D model.
     */
    this.setupPicking();


    /*
     * Make beam picking easier.
     */
    if (this.bounds) {

      this.raycaster.params.Line.threshold =
        Math.max(
          this.bounds.sphere.radius *
          0.003,
          1e-6
        );

    }


    /*
     * Apply initial Part/material/section colours.
     */
    this.applyAppearance();


    /* --------------------------------------------------------
       Resize monitoring
       -------------------------------------------------------- */

    this.resizeObserver =
      new ResizeObserver(() => {
        this.resize();
      });

    this.resizeObserver.observe(
      this.host
    );


    /* --------------------------------------------------------
       Render loop
       -------------------------------------------------------- */

    this.renderer.setAnimationLoop(
      () => {

        this.controls.update();

        this.renderer.render(
          this.scene,
          this.camera
        );

      }
    );
  }

  colorForObject(
    partId,
    kind
  ) {

    const id =
      String(partId);


    const metadata =
      this.partMetadata.get(id) ||
      {};


    if (
      this.colorMode ===
      "material"
    ) {

      return categoricalColor(
        `material-${metadata.materialId}`
      );

    }


    if (
      this.colorMode ===
      "section"
    ) {

      return categoricalColor(
        `section-${metadata.sectionId}`
      );

    }


    if (
      this.colorMode ===
      "element"
    ) {

      return (
        ELEMENT_COLORS[kind] ||
        ELEMENT_COLORS.other
      ).clone();

    }


    return categoricalColor(
      `part-${id}`
    );
  }


  /* ========================================================
     MODEL BUILD
     ======================================================== */

  buildModel() {

    const geometryStore =
      this.model;

    if (
      !geometryStore ||
      !geometryStore.positionArray ||
      !geometryStore.nodeIndex
    ) {

      throw new Error(
        "No parsed LS-DYNA geometry is available."
      );
    }


    const sharedPositions =
      new THREE.BufferAttribute(
        geometryStore.positionArray,
        3
      );


    let renderedParts = 0;


    geometryStore.parts.forEach(
      (partData, partId) => {

        let partRendered = false;

        /* --------------------------------------------------
           Shells
           -------------------------------------------------- */

        if (
          partData.shell &&
          partData.shell.length
        ) {

          const indices =
            shellIndices(
              partData.shell,
              geometryStore.nodeIndex
            );

          if (indices.length) {

            const geometry =
              new THREE.BufferGeometry();

            geometry.setAttribute(
              "position",
              sharedPositions
            );

            geometry.setIndex(
              new THREE.BufferAttribute(
                indices,
                1
              )
            );

            geometry.computeVertexNormals();


            const shellColor =
              this.colorForObject(
                partId,
                "shell"
              );


            const material =
              new THREE.MeshStandardMaterial({
                color: shellColor,
                roughness: 0.74,
                metalness: 0.04,
                side: THREE.DoubleSide
              });


            const mesh =
              new THREE.Mesh(
                geometry,
                material
              );

            mesh.userData = {
              partId,
              kind: "shell"
            };

            this.modelGroup.add(
              mesh
            );

            this.meshes.push(
              mesh
            );

            this.registerPartObject(
              partId,
              mesh
            );

            partRendered = true;
          }
        }


        /* --------------------------------------------------
           Solids
           -------------------------------------------------- */

        if (
          partData.solid &&
          partData.solid.length
        ) {

          const indices =
            solidIndices(
              partData.solid,
              geometryStore.nodeIndex
            );

          if (indices.length) {

            const geometry =
              new THREE.BufferGeometry();

            geometry.setAttribute(
              "position",
              sharedPositions
            );

            geometry.setIndex(
              new THREE.BufferAttribute(
                indices,
                1
              )
            );

            geometry.computeVertexNormals();


            const solidColor =
              this.colorForObject(
                partId,
                "solid"
              );


            const material =
              new THREE.MeshStandardMaterial({
                color: solidColor,
                roughness: 0.82,
                metalness: 0,
                side: THREE.DoubleSide
              });


            const mesh =
              new THREE.Mesh(
                geometry,
                material
              );

            mesh.userData = {
              partId,
              kind: "solid"
            };

            this.modelGroup.add(
              mesh
            );

            this.meshes.push(
              mesh
            );

            this.registerPartObject(
              partId,
              mesh
            );

            partRendered = true;
          }
        }


        /* --------------------------------------------------
           Beams
           -------------------------------------------------- */

        if (
          partData.beam &&
          partData.beam.length
        ) {

          const indices =
            beamIndices(
              partData.beam,
              geometryStore.nodeIndex
            );

          if (indices.length) {

            const geometry =
              new THREE.BufferGeometry();

            geometry.setAttribute(
              "position",
              sharedPositions
            );

            geometry.setIndex(
              new THREE.BufferAttribute(
                indices,
                1
              )
            );


            const beamColor =
              this.colorForObject(
                partId,
                "beam"
              );


            const material =
              new THREE.LineBasicMaterial({
                color: beamColor
              });


            const lines =
              new THREE.LineSegments(
                geometry,
                material
              );

            lines.userData = {
              partId,
              kind: "beam"
            };

            this.modelGroup.add(
              lines
            );

            this.meshes.push(
              lines
            );

            this.registerPartObject(
              partId,
              lines
            );

            partRendered = true;
          }
        }


        if (partRendered) {
          renderedParts += 1;
        }

      }
    );


    if (this.statusElement) {

      this.statusElement.textContent =
        `${geometryStore.nodeCount.toLocaleString()} nodes · ` +
        `${renderedParts.toLocaleString()} rendered parts`;

    }
  }

  /* ========================================================
     BATCH 4 — PART REGISTRATION
     ======================================================== */

  registerPartObject(
    partId,
    object
  ) {

    const id =
      String(partId);


    if (
      !this.partObjects.has(id)
    ) {

      this.partObjects.set(
        id,
        []
      );

    }


    this.partObjects
      .get(id)
      .push(object);


    object.userData.partId =
      id;
  }


  /* ========================================================
     BATCH 4 — APPEARANCE
     ======================================================== */

  applyAppearance() {

    this.meshes.forEach(
      (object) => {

        const partId =
          String(
            object.userData.partId
          );


        const kind =
          object.userData.kind;


        const selected =
          partId ===
          String(
            this.selectedPartId
          );


        const baseColor =
          this.colorForObject(
            partId,
            kind
          );


        if (
          object.material?.color
        ) {

          object.material.color.copy(
            selected
              ? SELECTION_COLOR
              : baseColor
          );

        }


        const opacity =
          this.partOpacity.has(partId)
            ? this.partOpacity.get(partId)
            : 1;


        object.material.opacity =
          opacity;


        object.material.transparent =
          opacity < 1;


        object.material.depthWrite =
          opacity >= 0.98;


        object.material.needsUpdate =
          true;

      }
    );
  }


  setColorMode(mode) {

    if (
      ![
        "part",
        "material",
        "section",
        "element"
      ].includes(mode)
    ) {
      return;
    }


    this.colorMode =
      mode;


    this.applyAppearance();
  }


  setPartOpacity(
    partId,
    opacity
  ) {

    const id =
      String(partId);


    const safeOpacity =
      THREE.MathUtils.clamp(
        Number(opacity),
        0.1,
        1
      );


    this.partOpacity.set(
      id,
      safeOpacity
    );


    this.applyAppearance();
  }


  /* ========================================================
     BATCH 4 — PART SELECTION
     ======================================================== */

  selectPart(
    partId,
    notify = false
  ) {

    this.selectedPartId =
      partId === null ||
      partId === undefined
        ? null
        : String(partId);


    this.applyAppearance();


    if (
      notify &&
      this.onSelect
    ) {

      this.onSelect(
        this.selectedPartId
      );

    }
  }


  /* ========================================================
     BATCH 4 — PART VISIBILITY
     ======================================================== */

  togglePart(partId) {

    const id =
      String(partId);


    const objects =
      this.partObjects.get(id);


    if (
      !objects ||
      !objects.length
    ) {

      return false;
    }


    const newVisibility =
      !objects.some(
        (object) =>
          object.visible
      );


    objects.forEach(
      (object) => {

        object.visible =
          newVisibility;

      }
    );


    return newVisibility;
  }


  isolatePart(partId) {

    const id =
      String(partId);


    this.meshes.forEach(
      (object) => {

        object.visible =
          String(
            object.userData.partId
          ) === id;

      }
    );


    this.selectPart(
      id
    );
  }


  showAllParts() {

    this.meshes.forEach(
      (object) => {

        const kind =
          object.userData.kind;


        object.visible =
          this.kindVisibility[kind] !==
          false;

      }
    );
  }


  /* ========================================================
     BATCH 4 — 3D CLICK SELECTION
     ======================================================== */

  setupPicking() {

    const canvas =
      this.renderer.domElement;


    canvas.addEventListener(
      "pointerdown",
      (event) => {

        this.pointerStart = {
          x: event.clientX,
          y: event.clientY
        };

      }
    );


    canvas.addEventListener(
      "pointerup",
      (event) => {

        if (!this.pointerStart) {
          return;
        }


        const dx =
          event.clientX -
          this.pointerStart.x;

        const dy =
          event.clientY -
          this.pointerStart.y;


        this.pointerStart =
          null;


        /*
         * If the mouse moved more than 5 px,
         * it was probably orbit/pan instead of a click.
         */
        if (
          Math.sqrt(
            dx * dx +
            dy * dy
          ) > 5
        ) {

          return;
        }


        /*
         * Only left mouse button selects.
         */
        if (
          event.button !== 0
        ) {
          return;
        }


        const rect =
          canvas.getBoundingClientRect();


        this.pointer.x =
          (
            (
              event.clientX -
              rect.left
            ) /
            rect.width
          ) * 2 - 1;


        this.pointer.y =
          -(
            (
              event.clientY -
              rect.top
            ) /
            rect.height
          ) * 2 + 1;


        this.raycaster.setFromCamera(
          this.pointer,
          this.camera
        );


        const candidates =
          this.meshes.filter(
            (object) =>
              object.visible
          );


        const intersections =
          this.raycaster.intersectObjects(
            candidates,
            false
          );


        if (
          !intersections.length
        ) {

          this.selectPart(
            null,
            true
          );

          return;
        }


        const object =
          intersections[0].object;


        const partId =
          object.userData.partId;


        this.selectPart(
          partId,
          true
        );

      }
    );
  }  


  /* ========================================================
     CAMERA
     ======================================================== */

  resize() {

    const width =
      Math.max(
        1,
        this.host.clientWidth
      );

    const height =
      Math.max(
        1,
        this.host.clientHeight
      );

    this.camera.aspect =
      width / height;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      width,
      height,
      false
    );
  }


  updateAxes() {

    if (!this.bounds) {
      return;
    }

    const size =
      this.bounds.box.getSize(
        new THREE.Vector3()
      );

    const scale =
      Math.max(
        size.x,
        size.y,
        size.z
      );

    this.axes.scale.setScalar(
      Math.max(
        scale * 0.08,
        1
      )
    );
  }


  fit() {

    if (!this.bounds) {
      return;
    }

    const center =
      this.bounds.sphere.center;

    const radius =
      Math.max(
        this.bounds.sphere.radius,
        1e-6
      );

    const distance =
      cameraDistanceForSphere(
        this.camera,
        radius
      );


    const direction =
      this.camera.position
        .clone()
        .sub(center);

    if (
      direction.lengthSq() <
      1e-8
    ) {

      direction.set(
        1,
        -1,
        0.75
      );
    }

    direction.normalize();


    this.camera.position
      .copy(center)
      .addScaledVector(
        direction,
        distance
      );


    this.controls.target.copy(
      center
    );


    this.camera.near =
      Math.max(
        distance / 10000,
        0.001
      );

    this.camera.far =
      Math.max(
        distance * 100,
        1000
      );


    this.camera.updateProjectionMatrix();

    this.controls.update();
  }


  setView(view) {

    if (!this.bounds) {
      return;
    }


    const center =
      this.bounds.sphere.center;

    const radius =
      Math.max(
        this.bounds.sphere.radius,
        1e-6
      );

    const distance =
      cameraDistanceForSphere(
        this.camera,
        radius
      );


    const directions = {

      iso:
        new THREE.Vector3(
          1,
          -1,
          0.75
        ),

      front:
        new THREE.Vector3(
          0,
          -1,
          0
        ),

      right:
        new THREE.Vector3(
          1,
          0,
          0
        ),

      top:
        new THREE.Vector3(
          0,
          0,
          1
        )

    };


    const direction =
      (
        directions[view] ||
        directions.iso
      ).normalize();


    this.camera.position
      .copy(center)
      .addScaledVector(
        direction,
        distance
      );


    this.controls.target.copy(
      center
    );


    this.camera.near =
      Math.max(
        distance / 10000,
        0.001
      );

    this.camera.far =
      Math.max(
        distance * 100,
        1000
      );


    if (view === "top") {

      this.camera.up.set(
        0,
        1,
        0
      );

    } else {

      this.camera.up.set(
        0,
        0,
        1
      );

    }


    this.camera.updateProjectionMatrix();

    this.controls.update();
  }


  /* ========================================================
     DISPLAY CONTROLS
     ======================================================== */

  toggleWireframe() {

    let enabled = false;

    const surface =
      this.meshes.find(
        (object) =>
          object.isMesh
      );

    if (surface) {
      enabled =
        !surface.material.wireframe;
    }


    this.meshes.forEach(
      (object) => {

        if (
          object.isMesh &&
          object.material
        ) {

          object.material.wireframe =
            enabled;

          object.material.needsUpdate =
            true;
        }

      }
    );

    return enabled;
  }


  toggleKind(kind) {

    if (
      !(kind in this.kindVisibility)
    ) {
      return true;
    }


    const visible =
      !this.kindVisibility[kind];

    this.kindVisibility[kind] =
      visible;


    this.meshes.forEach(
      (object) => {

        if (
          object.userData.kind === kind
        ) {

          object.visible =
            visible;
        }

      }
    );


    return visible;
  }


  /* ========================================================
     CLEANUP
     ======================================================== */

  dispose() {

    if (this.resizeObserver) {

      this.resizeObserver.disconnect();

    }


    if (this.renderer) {

      this.renderer.setAnimationLoop(
        null
      );

    }


    if (this.controls) {

      this.controls.dispose();

    }


    this.scene.traverse(
      (object) => {

        if (object.geometry) {

          object.geometry.dispose();

        }


        if (object.material) {

          const materials =
            Array.isArray(
              object.material
            )
              ? object.material
              : [object.material];


          materials.forEach(
            (material) => {
              material.dispose();
            }
          );
        }

      }
    );


    if (this.renderer) {

      this.renderer.dispose();

      this.renderer.domElement.remove();

    }


    this.host = null;
  }
}


/* ============================================================
   PUBLIC API
   ============================================================ */

window.CorrosionAtlasLsdynaViewer = {

  mount(host, model, options = {}) {

    if (currentViewer) {

      currentViewer.dispose();

      currentViewer = null;

    }


    currentViewer =
      new LsdynaViewer(
        host,
        model,
        options
      );


    return currentViewer;
  },


  dispose() {

    if (!currentViewer) {
      return;
    }


    currentViewer.dispose();

    currentViewer = null;
  },


  fit() {

    currentViewer?.fit();

  },


  setView(view) {

    currentViewer?.setView(
      view
    );

  },


  toggleWireframe() {

    return (
      currentViewer?.toggleWireframe() ??
      false
    );

  },


  toggleKind(kind) {

    return (
      currentViewer?.toggleKind(kind) ??
      true
    );

  },


  selectPart(partId) {

    currentViewer?.selectPart(
      partId
    );

  },


  togglePart(partId) {

    return (
      currentViewer?.togglePart(
        partId
      ) ??
      false
    );

  },


  isolatePart(partId) {

    currentViewer?.isolatePart(
      partId
    );

  },


  showAllParts() {

    currentViewer?.showAllParts();

  },


  setPartOpacity(
    partId,
    opacity
  ) {

    currentViewer?.setPartOpacity(
      partId,
      opacity
    );

  },


  setColorMode(mode) {

    currentViewer?.setColorMode(
      mode
    );

  }

};


window.dispatchEvent(
  new CustomEvent(
    "lsdyna-viewer-ready"
  )
);