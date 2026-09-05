import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";


let currentViewer = null;


/* ============================================================
   BASIC HELPERS
   ============================================================ */

function partColor(partId) {
  const numericId = Number(partId) || 1;

  const hue =
    (numericId * 0.61803398875) % 1;

  const color = new THREE.Color();

  color.setHSL(
    hue,
    0.42,
    0.58
  );

  return color;
}


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

        const color =
          partColor(partId);

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


            const material =
              new THREE.MeshStandardMaterial({
                color,
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


            const material =
              new THREE.MeshStandardMaterial({
                color,
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


            const material =
              new THREE.LineBasicMaterial({
                color
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

  }

};


window.dispatchEvent(
  new CustomEvent(
    "lsdyna-viewer-ready"
  )
);