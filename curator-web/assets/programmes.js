
const programmeList = document.getElementById("programme-list");
const programmeForm = document.getElementById("programme-form");
const programmeId = document.getElementById("programme-id");
const programmeDisplay = document.getElementById("programme-display");
const programmeFull = document.getElementById("programme-full");
const programmeDescription = document.getElementById("programme-description");
const programmeStatus = document.getElementById("programme-status");
const programmeClear = document.getElementById("programme-clear");

function resetProgrammeForm() {
  programmeForm.reset();
  programmeId.value = "";
  programmeDisplay.readOnly = false;
  programmeStatus.hidden = true;
}

function showProgrammeStatus(message, error = false) {
  programmeStatus.textContent = message;
  programmeStatus.className = error
    ? "save-message save-message-error"
    : "save-message save-message-success";
  programmeStatus.hidden = false;
}

async function loadProgrammes() {
  const response = await fetch("/api/programmes");
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Unable to load programmes.");
  }

  programmeList.replaceChildren();

  for (const programme of data.programmes) {
    const row = document.createElement("div");
    row.className = "detail-field";

    const content = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = programme.display_name;

    const full = document.createElement("div");
    full.textContent = programme.full_name || "Full name not specified";
    full.style.marginTop = "4px";

    content.append(name, full);

    const edit = document.createElement("button");
    edit.className = "button";
    edit.type = "button";
    edit.textContent = "Edit";

    edit.addEventListener("click", () => {
      programmeId.value = programme.id;
      programmeDisplay.value = programme.display_name;
      programmeFull.value = programme.full_name || "";
      programmeDescription.value = programme.description || "";

      // Editing the abbreviation itself is restricted,
      // because existing source records use that abbreviation.
      programmeDisplay.readOnly = true;
      programmeStatus.hidden = true;
      programmeForm.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });

    row.append(content, edit);
    programmeList.append(row);
  }
}

programmeClear.addEventListener("click", resetProgrammeForm);

programmeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = programmeForm.querySelector('[type="submit"]');
  button.disabled = true;

  const payload = {
    id: programmeId.value || null,
    display_name: programmeDisplay.value.trim(),
    full_name: programmeFull.value.trim(),
    description: programmeDescription.value.trim()
  };

  try {
    const response = await fetch("/api/programmes", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to save programme.");
    }

    resetProgrammeForm();
    await loadProgrammes();
    showProgrammeStatus("Programme saved successfully.");
  } catch (error) {
    showProgrammeStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

loadProgrammes().catch((error) => {
  showProgrammeStatus(error.message, true);
});
