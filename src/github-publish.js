function cleanText(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


function getGitHubConfig(
  env
) {
  return {
    token:
      cleanText(
        env.GITHUB_TOKEN
      ),

    owner:
      cleanText(
        env.GITHUB_REPO_OWNER ||
        "cbixx"
      ),

    repo:
      cleanText(
        env.GITHUB_REPO_NAME ||
        "global-corrosion-site-maps"
      ),

    branch:
      cleanText(
        env.GITHUB_BRANCH ||
        "main"
      ),
  };
}


function requireGitHubConfig(
  env
) {
  const config =
    getGitHubConfig(
      env
    );

  const missing = [];

  if (!config.token) {
    missing.push(
      "GITHUB_TOKEN"
    );
  }

  if (!config.owner) {
    missing.push(
      "GITHUB_REPO_OWNER"
    );
  }

  if (!config.repo) {
    missing.push(
      "GITHUB_REPO_NAME"
    );
  }

  if (
    missing.length
  ) {
    throw new Error(
      "Missing GitHub publish configuration: " +
      missing.join(", ")
    );
  }

  return config;
}


function githubHeaders(
  config
) {
  return {
    accept:
      "application/vnd.github+json",

    authorization:
      `Bearer ${config.token}`,

    "x-github-api-version":
      "2022-11-28",
  };
}


function encodeRepoPath(
  repoPath
) {
  return String(
    repoPath
  )
    .replace(
      /^\/+/,
      ""
    )
    .split("/")
    .map(
      (part) =>
        encodeURIComponent(
          part
        )
    )
    .join("/");
}


function contentsUrl(
  config,
  repoPath
) {
  return (
    `https://api.github.com/repos/` +
    `${encodeURIComponent(config.owner)}/` +
    `${encodeURIComponent(config.repo)}/` +
    `contents/${encodeRepoPath(repoPath)}`
  );
}


function encodeUtf8Base64(
  text
) {
  const bytes =
    new TextEncoder()
      .encode(
        text
      );

  let binary = "";

  const chunkSize =
    0x8000;

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        offset,
        Math.min(
          offset +
            chunkSize,
          bytes.length
        )
      );

    binary +=
      String.fromCharCode(
        ...chunk
      );
  }

  return btoa(
    binary
  );
}


function decodeBase64Bytes(
  value
) {
  const compact =
    String(
      value ||
      ""
    )
      .replace(
        /\s+/g,
        ""
      );

  if (!compact) {
    return null;
  }

  const binary =
    atob(
      compact
    );

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index
      );
  }

  return bytes;
}


function bytesEqual(
  first,
  second
) {
  if (
    first.length !==
    second.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index < first.length;
    index += 1
  ) {
    if (
      first[index] !==
      second[index]
    ) {
      return false;
    }
  }

  return true;
}


async function getGitHubFileInfo(
  config,
  repoPath
) {
  const url =
    new URL(
      contentsUrl(
        config,
        repoPath
      )
    );

  url.searchParams.set(
    "ref",
    config.branch
  );

  const response =
    await fetch(
      url,
      {
        headers:
          githubHeaders(
            config
          ),
      }
    );

  if (
    response.status ===
    404
  ) {
    return null;
  }

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `GitHub GET failed for ${repoPath}: ` +
      `${response.status} ${detail.slice(0, 400)}`
    );
  }

  const payload =
    await response.json();

  if (
    payload.type !==
    "file"
  ) {
    throw new Error(
      `GitHub path exists but is not a file: ${repoPath}`
    );
  }

  return payload;
}


async function getExistingGitHubBytes(
  config,
  fileInfo
) {
  if (
    fileInfo.encoding ===
      "base64" &&
    fileInfo.content
  ) {
    return decodeBase64Bytes(
      fileInfo.content
    );
  }

  const downloadUrl =
    cleanText(
      fileInfo.download_url
    );

  if (!downloadUrl) {
    return null;
  }

  const response =
    await fetch(
      downloadUrl,
      {
        headers: {
          accept:
            "application/octet-stream",
        },
      }
    );

  if (!response.ok) {
    return null;
  }

  return new Uint8Array(
    await response.arrayBuffer()
  );
}


async function putGitHubFile(
  config,
  {
    repoPath,
    content,
    commitMessage,
  }
) {
  const fileInfo =
    await getGitHubFileInfo(
      config,
      repoPath
    );

  const newBytes =
    new TextEncoder()
      .encode(
        content
      );

  let action =
    "created";

  let sha =
    "";

  if (fileInfo) {
    sha =
      cleanText(
        fileInfo.sha
      );

    const existingBytes =
      await getExistingGitHubBytes(
        config,
        fileInfo
      );

    if (
      existingBytes &&
      bytesEqual(
        existingBytes,
        newBytes
      )
    ) {
      return {
        ok: true,

        path:
          repoPath,

        action:
          "skipped",

        html_url:
          cleanText(
            fileInfo.html_url
          ),

        commit_sha:
          "",
      };
    }

    action =
      "updated";
  }

  const body = {
    message:
      commitMessage,

    content:
      encodeUtf8Base64(
        content
      ),

    branch:
      config.branch,
  };

  if (sha) {
    body.sha =
      sha;
  }

  const response =
    await fetch(
      contentsUrl(
        config,
        repoPath
      ),
      {
        method:
          "PUT",

        headers: {
          ...githubHeaders(
            config
          ),

          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(
            body
          ),
      }
    );

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `GitHub PUT failed for ${repoPath}: ` +
      `${response.status} ${detail.slice(0, 700)}`
    );
  }

  const payload =
    await response.json();

  return {
    ok: true,

    path:
      repoPath,

    action,

    html_url:
      cleanText(
        payload.content
          ?.html_url
      ),

    commit_sha:
      cleanText(
        payload.commit
          ?.sha
      ),
  };
}


function currentPublishDate() {
  const now =
    new Date();

  const year =
    String(
      now.getUTCFullYear()
    );

  const month =
    String(
      now.getUTCMonth() +
      1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      now.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return (
    year +
    month +
    day
  );
}


async function getNextBatchPath(
  config
) {
  const directory =
    "data/publish_batches";

  const url =
    new URL(
      contentsUrl(
        config,
        directory
      )
    );

  url.searchParams.set(
    "ref",
    config.branch
  );

  const response =
    await fetch(
      url,
      {
        headers:
          githubHeaders(
            config
          ),
      }
    );

  let rows = [];

  if (
    response.status !==
    404
  ) {
    if (!response.ok) {
      const detail =
        await response.text();

      throw new Error(
        "Unable to inspect GitHub publish batches: " +
        `${response.status} ${detail.slice(0, 400)}`
      );
    }

    rows =
      await response.json();

    if (
      !Array.isArray(
        rows
      )
    ) {
      rows = [];
    }
  }

  const dateText =
    currentPublishDate();

  const pattern =
    new RegExp(
      `^publish_batch(\\d{2})_${dateText}\\.csv$`,
      "i"
    );

  let maxNumber =
    0;

  for (
    const row
    of rows
  ) {
    const match =
      cleanText(
        row.name
      ).match(
        pattern
      );

    if (!match) {
      continue;
    }

    maxNumber =
      Math.max(
        maxNumber,
        Number(
          match[1]
        )
      );
  }

  const nextNumber =
    maxNumber +
    1;

  return (
    `${directory}/` +
    `publish_batch${String(
      nextNumber
    ).padStart(
      2,
      "0"
    )}_${dateText}.csv`
  );
}


export function getGitHubPublishStatus(
  env
) {
  const config =
    getGitHubConfig(
      env
    );

  return {
    configured:
      Boolean(
        config.token &&
        config.owner &&
        config.repo
      ),

    token_present:
      Boolean(
        config.token
      ),

    owner:
      config.owner,

    repo:
      config.repo,

    branch:
      config.branch,
  };
}


export async function publishWebsiteFilesToGitHub(
  env,
  {
    files,
    commitMessage,
  }
) {
  const config =
    requireGitHubConfig(
      env
    );

  const cleanCommitMessage =
    cleanText(
      commitMessage
    ) ||
    "Update corrosion map website dataset";

  const publishFiles = {
    ...files,
  };

  /*
   * Preserve the legacy dated Site snapshot.
   */
  const sitesCsv =
    publishFiles[
      "data/sites.csv"
    ];

  if (!sitesCsv) {
    throw new Error(
      "Generated website package does not contain data/sites.csv."
    );
  }

  const batchPath =
    await getNextBatchPath(
      config
    );

  publishFiles[
    batchPath
  ] =
    sitesCsv;

  const uploads = [];

  const entries =
    Object.entries(
      publishFiles
    );

  for (
    let index = 0;
    index < entries.length;
    index += 1
  ) {
    const [
      repoPath,
      content,
    ] =
      entries[index];

    try {
      const result =
        await putGitHubFile(
          config,
          {
            repoPath,
            content,
            commitMessage:
              cleanCommitMessage,
          }
        );

      uploads.push(
        result
      );

    } catch (error) {
      return {
        ok: false,

        partial:
          uploads.length > 0,

        changed_count:
          uploads.filter(
            (row) =>
              row.action ===
                "created" ||
              row.action ===
                "updated"
          ).length,

        skipped_count:
          uploads.filter(
            (row) =>
              row.action ===
              "skipped"
          ).length,

        batch_path:
          batchPath,

        uploads,

        failed_path:
          repoPath,

        error:
          error?.message ||
          String(error),
      };
    }
  }

  const changedCount =
    uploads.filter(
      (row) =>
        row.action ===
          "created" ||
        row.action ===
          "updated"
    ).length;

  const skippedCount =
    uploads.filter(
      (row) =>
        row.action ===
        "skipped"
    ).length;

  return {
    ok: true,

    partial:
      false,

    changed_count:
      changedCount,

    skipped_count:
      skippedCount,

    batch_path:
      batchPath,

    uploads,
  };
}