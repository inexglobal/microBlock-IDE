// Public GitHub downloads are still used by the extension installer. The
// authenticated GitHub project/sign-in feature has intentionally been removed.
localStorage.removeItem("access_token");

let downloadRepoFromGitHubStoreInFS = async (url, storePath, onError = () => "") => {
    const match = /\/\/.+\/([^/]+\/[^/]+)\/?/gm.exec(url);
    if (!match) {
        onError("Invalid GitHub repository URL");
        return false;
    }

    const gitRepoBase = match[1];
    let repoTree = await fetch(`https://api.github.com/repos/${gitRepoBase}/git/trees/master?recursive=1`);
    if (!repoTree.ok) {
        onError(`${gitRepoBase} download fail`);
        return false;
    }

    repoTree = await repoTree.json();
    for (const object of repoTree.tree) {
        if (object.type !== "blob") continue;

        if (object.size >= 500 * 1023) {
            onError(`${object.path} over 500kB`);
            continue;
        }

        const downloaded = await downloadFile(
            `https://api.github.com/repos/${gitRepoBase}/contents/${object.path}`,
            `${storePath}/${object.path}`,
            onError
        );
        if (!downloaded) return false;
    }

    return true;
};

let downloadFile = async (url, saveAs, onError = () => "") => {
    const isImage = saveAs.endsWith(".png") || saveAs.endsWith(".jpg");
    const fileDownload = await fetch(url, {
        redirect: "follow",
        headers: {
            "Accept": isImage ? "application/vnd.github.v3+json" : "application/vnd.github.v3.raw"
        }
    });

    if (!fileDownload.ok) {
        onError(`${url} download fail`);
        return false;
    }

    const contentType = fileDownload.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
        const content = (await fileDownload.json()).content;
        if (isImage) {
            const imageType = saveAs.endsWith(".png") ? "png" : "jpg";
            fs.write(saveAs, `data:image/${imageType};base64,${content}`);
        } else {
            fs.write(saveAs, Base64.decode(content));
        }
    } else if (isImage) {
        const imageType = saveAs.endsWith(".png") ? "png" : "jpg";
        const bytes = new Uint8Array(await fileDownload.arrayBuffer());
        fs.write(saveAs, `data:image/${imageType};base64,${btoa(String.fromCharCode.apply(null, bytes))}`);
    } else {
        fs.write(saveAs, await fileDownload.text());
    }

    return true;
};
