let blocklyWorkspaceShare = null;

const updateSharePreviewScale = () => {
    const percentage = blocklyWorkspaceShare
        ? Math.round(blocklyWorkspaceShare.scale * 100)
        : 100;
    $("#share-preview-zoom-level").text(`${percentage}%`);
};

const updateSharePreview = () => {
    if (!blocklyWorkspaceShare) {
        blocklyWorkspaceShare = Blockly.inject($("#code-share-dialog .preview-block")[0], {
            media: "blockly/media/",
            sounds: false,
            grid: {
                spacing: 25,
                length: 1,
                colour: "#888",
                snap: true
            },
            zoom: {
                startScale: 1,
                maxScale: 2.5,
                minScale: 0.08,
                controls: false,
                wheel: false
            },
            scrollbars: true,
            readOnly: true
        });
    }

    blocklyWorkspaceShare.clear();
    Blockly.Xml.domToWorkspace(
        Blockly.Xml.workspaceToDom(blocklyWorkspace),
        blocklyWorkspaceShare
    );

    const resizeAndFitPreview = () => {
        if (!blocklyWorkspaceShare || !$("#code-share-dialog").is(":visible")) return;

        Blockly.svgResize(blocklyWorkspaceShare);
        if (blocklyWorkspaceShare.getAllBlocks(false).length > 0) {
            blocklyWorkspaceShare.zoomToFit();
            if (blocklyWorkspaceShare.scale > 1) {
                blocklyWorkspaceShare.setScale(1);
                blocklyWorkspaceShare.scrollCenter();
            }
        }
        updateSharePreviewScale();
    };

    resizeAndFitPreview();

    const renderComplete = Blockly.renderManagement
        && typeof Blockly.renderManagement.finishQueuedRenders === "function"
        ? Blockly.renderManagement.finishQueuedRenders()
        : Promise.resolve();

    renderComplete.then(() => {
        requestAnimationFrame(() => requestAnimationFrame(resizeAndFitPreview));
        // Custom fields and images can update their dimensions after Blockly's render queue.
        setTimeout(resizeAndFitPreview, 120);
    });
};

const resetExportDialog = () => {
    try {
        saveCodeToLocal();
        updateSharePreview();
    } catch (error) {
        console.error("Export preview failed", error);
        NotifyE("Could not prepare the project preview");
    }
};

const getProjectBaseName = () => {
    const projectName = String($("#project-name").val() || "myProject").trim();
    return projectName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || "myProject";
};

const getProjectFileName = () => `${getProjectBaseName()}.mby`;

const getSourceExportConfig = () => {
    const board = boards.find(item => item.id === boardId);
    const isArduinoPlatform = Boolean(board && board.isArduinoPlatform);

    return isArduinoPlatform ? {
        language: "C++",
        extension: "cpp",
        mimeType: "text/x-c++src",
        iconClass: "fas fa-code",
        generator: Blockly.JavaScript
    } : {
        language: "Python",
        extension: "py",
        mimeType: "text/x-python",
        iconClass: "fab fa-python",
        generator: Blockly.Python
    };
};

const updateSourceExportUI = () => {
    const config = getSourceExportConfig();
    $("#share-code-description").text(`Export or copy the generated ${config.language} code.`);
    $("#export-source-code-label").text(`Export ${config.language} (.${config.extension})`);
    $("#copy-source-code-label").text(`Copy ${config.language} Code`);
    $("#export-source-code > i").attr("class", config.iconClass);
};

const getCurrentSourceCode = () => {
    saveCodeToLocal();
    const config = getSourceExportConfig();

    if (useMode === "code") {
        const storedCode = fs.read("/main.py");
        if (typeof storedCode === "string") return storedCode;
        if (editor) return editor.getValue();
    }

    return config.generator.workspaceToCode(blocklyWorkspace);
};

const copyTextToClipboard = async text => {
    if (isElectron) {
        require("electron").clipboard.writeText(text);
        return true;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.warn("Clipboard API failed; using fallback", error);
        }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
};

const exportSourceCode = async () => {
    try {
        const config = getSourceExportConfig();
        const sourceCode = getCurrentSourceCode();
        const fileName = `${getProjectBaseName()}.${config.extension}`;

        if (isElectron) {
            const result = await dialog.showSaveDialog({
                filters: [{
                    name: `${config.language} source code`,
                    extensions: [config.extension]
                }],
                defaultPath: fileName
            });

            if (result.canceled) return;

            await new Promise((resolve, reject) => {
                nodeFS.writeFile(result.filePath, sourceCode, "utf8", error => error ? reject(error) : resolve());
            });
            NotifyS(`${config.language} code exported to ${result.filePath}`);
            return;
        }

        const blob = new Blob([sourceCode], { type: `${config.mimeType};charset=utf-8` });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = fileName;
        link.href = url;
        link.click();
        window.URL.revokeObjectURL(url);
        NotifyS(`${config.language} code exported`);
    } catch (error) {
        console.error("Export source code failed", error);
        NotifyE("Export source code failed");
    }
};

const copySourceCode = async () => {
    try {
        const config = getSourceExportConfig();
        const sourceCode = getCurrentSourceCode();
        if (await copyTextToClipboard(sourceCode)) {
            NotifyS(`${config.language} code copied`);
        } else {
            NotifyE("Could not copy source code");
        }
    } catch (error) {
        console.error("Copy source code failed", error);
        NotifyE("Copy source code failed");
    }
};

const exportProjectFile = async () => {
    try {
        saveCodeToLocal();
        const fileName = getProjectFileName();
        const fileContent = JSON.stringify(vFSTree);

        if (isElectron) {
            const result = await dialog.showSaveDialog({
                filters: [{
                    name: "microBlock IDE",
                    extensions: ["mby"]
                }],
                defaultPath: fileName
            });

            if (result.canceled) return;

            await new Promise((resolve, reject) => {
                nodeFS.writeFile(result.filePath, fileContent, error => error ? reject(error) : resolve());
            });
            NotifyS(`Project exported to ${result.filePath}`);
            return;
        }

        if (navigator.share && navigator.canShare) {
            const file = new File([fileContent], fileName, { type: "application/json" });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: $("#project-name").val() || "microBlock Project",
                    text: "microBlock IDE project file",
                    files: [file]
                });
                return;
            }
        }

        const blob = new Blob([fileContent], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = fileName;
        link.href = url;
        link.click();
        window.URL.revokeObjectURL(url);
        NotifyS("Project file exported");
    } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Export project failed", error);
        NotifyE("Export project failed");
    }
};

const collectBlocklyStyles = () => {
    const styles = [];

    for (const styleSheet of document.styleSheets) {
        try {
            for (const rule of styleSheet.cssRules || []) {
                const cssText = rule.cssText || "";
                const lowerText = cssText.toLowerCase();
                if (lowerText.includes("blockly") || lowerText.includes("makevariablestyle")) {
                    styles.push(cssText);
                }
            }
        } catch (error) {
            console.warn("Could not read a stylesheet while exporting blocks", error);
        }
    }

    return styles.join("\n");
};

const blobToDataURL = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

const inlineSVGImages = async svg => {
    const images = Array.from(svg.querySelectorAll("image"));

    await Promise.all(images.map(async image => {
        const href = image.getAttribute("href") || image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (!href || href.startsWith("data:") || href.startsWith("blob:")) return;

        try {
            const response = await fetch(new URL(href, document.baseURI).href);
            if (!response.ok) throw new Error(`Image returned ${response.status}`);
            const dataURL = await blobToDataURL(await response.blob());
            image.setAttribute("href", dataURL);
            image.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataURL);
        } catch (error) {
            // An unresolved external image would taint PNG/JPG/PDF canvases.
            image.removeAttribute("href");
            image.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
            console.warn("Could not embed an image in the workspace screenshot", href, error);
        }
    }));
};

const inlineComputedSVGStyles = (sourceRoot, clonedRoot, elementPairs = null) => {
    const properties = [
        "color",
        "display",
        "visibility",
        "opacity",
        "fill",
        "fill-opacity",
        "stroke",
        "stroke-width",
        "stroke-opacity",
        "stroke-linecap",
        "stroke-linejoin",
        "font-family",
        "font-size",
        "font-style",
        "font-weight",
        "letter-spacing",
        "text-anchor",
        "dominant-baseline",
        "paint-order",
        "shape-rendering",
        "vector-effect"
    ];
    const sourceElements = elementPairs
        ? elementPairs.map(pair => pair[0]) : [sourceRoot, ...sourceRoot.querySelectorAll("*")];
    const clonedElements = elementPairs
        ? elementPairs.map(pair => pair[1]) : [clonedRoot, ...clonedRoot.querySelectorAll("*")];

    sourceElements.forEach((source, index) => {
        const target = clonedElements[index];
        if (!target || !(source instanceof Element) || !(target instanceof Element)) return;

        const computed = window.getComputedStyle(source);
        for (const property of properties) {
            const value = computed.getPropertyValue(property);
            if (value) target.style.setProperty(property, value);
        }
    });
};

const createWorkspaceSVG = async (options = {}) => {
    const transparentBackground = options.transparentBackground === true;

    if (blocklyWorkspace.getAllBlocks(false).length === 0) {
        throw new Error("Add at least one block before exporting a screenshot.");
    }

    const bounds = blocklyWorkspace.getBlocksBoundingBox();
    const padding = 24;
    const width = Math.max(1, Math.ceil(bounds.right - bounds.left + (padding * 2)));
    const height = Math.max(1, Math.ceil(bounds.bottom - bounds.top + (padding * 2)));
    const svgNamespace = "http://www.w3.org/2000/svg";
    const sourceSVG = blocklyWorkspace.getParentSvg();
    const svg = document.createElementNS(svgNamespace, "svg");

    const exportClasses = new Set(["blocklySvg"]);
    let classSource = sourceSVG;
    while (classSource && classSource !== document.body) {
        for (const className of classSource.classList || []) {
            if (className.includes("renderer") || className.includes("theme") || className === "blocklySvg") {
                exportClasses.add(className);
            }
        }
        classSource = classSource.parentElement;
    }

    svg.setAttribute("xmlns", svgNamespace);
    svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    svg.setAttribute("class", Array.from(exportClasses).join(" "));
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `${bounds.left - padding} ${bounds.top - padding} ${width} ${height}`);
    if (transparentBackground) svg.style.setProperty("background-color", "transparent", "important");

    const definitions = sourceSVG.querySelector("defs");
    if (definitions) svg.appendChild(definitions.cloneNode(true));

    const style = document.createElementNS(svgNamespace, "style");
    style.textContent = collectBlocklyStyles();
    svg.appendChild(style);

    if (!transparentBackground) {
        const background = document.createElementNS(svgNamespace, "rect");
        background.setAttribute("x", bounds.left - padding);
        background.setAttribute("y", bounds.top - padding);
        background.setAttribute("width", width);
        background.setAttribute("height", height);
        background.setAttribute("fill", "#FFFFFF");
        svg.appendChild(background);
    }

    const sourceBlockCanvas = blocklyWorkspace.getCanvas();
    const blockCanvas = sourceBlockCanvas.cloneNode(true);
    blockCanvas.removeAttribute("transform");
    inlineComputedSVGStyles(sourceBlockCanvas, blockCanvas);
    svg.appendChild(blockCanvas);

    await inlineSVGImages(svg);

    return {
        width,
        height,
        text: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`
    };
};

const exportProjectPackage = async () => {
    const button = $("#export-project-package");
    button.prop("disabled", true);

    try {
        if (typeof zip === "undefined" || !zip.ZipWriter) {
            throw new Error("ZIP support is not available.");
        }

        saveCodeToLocal();
        zip.configure({ useWebWorkers: false, useCompressionStream: false });

        const projectName = getProjectBaseName();
        const projectFileName = getProjectFileName();
        const sourceConfig = getSourceExportConfig();
        const sourceCode = getCurrentSourceCode();
        const board = boards.find(item => item.id === boardId);
        const version = typeof pjson !== "undefined" && pjson.version
            ? String(pjson.version)
            : String($("#app-current-version").text() || "Unknown");
        const exportedAt = new Date().toISOString();
        const packageInfo = {
            project: projectName,
            board: board ? { id: board.id, name: board.name } : { id: boardId || null, name: null },
            mode: useMode,
            sourceLanguage: sourceConfig.language,
            appVersion: version,
            exportedAt
        };
        const readme = [
            "microBlock IDE Project Package",
            "================================",
            `Project: ${projectName}`,
            `Board: ${packageInfo.board.name || packageInfo.board.id || "Unknown"}`,
            `Mode: ${useMode}`,
            `Source: ${sourceConfig.language}`,
            `microBlock IDE: v${version}`,
            `Exported: ${exportedAt}`,
            "",
            "Open the .mby file in microBlock IDE to continue editing the project."
        ].join("\r\n");

        // Store entries without compression for compatibility with the older
        // Chromium stream implementation bundled by the desktop app.
        const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"), { level: 0 });
        await writer.add(projectFileName, new zip.TextReader(JSON.stringify(vFSTree)));
        await writer.add(`${projectName}.${sourceConfig.extension}`, new zip.TextReader(sourceCode));
        await writer.add("project-info.json", new zip.TextReader(JSON.stringify(packageInfo, null, 2)));
        await writer.add("README.txt", new zip.TextReader(readme));

        if (useMode === "block" && blocklyWorkspace.getAllBlocks(false).length > 0) {
            const svgExport = await createWorkspaceSVG({ transparentBackground: false });
            await writer.add(`${projectName}-blocks.svg`, new zip.TextReader(svgExport.text));
        }

        const packageBlob = await writer.close();
        if (await saveExportBlob(packageBlob, `${projectName}-package.zip`, "zip")) {
            NotifyS("Project package exported");
        }
    } catch (error) {
        console.error("Export project package failed", error);
        NotifyE(error.message || "Export project package failed");
    } finally {
        button.prop("disabled", false);
    }
};

const createRasterCanvas = (svgExport, transparentBackground = false) => new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgExport.text], { type: "image/svg+xml;charset=utf-8" });
    const svgURL = window.URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
        const maxDimension = Math.max(svgExport.width, svgExport.height);
        const scale = Math.min(2, 8192 / maxDimension);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(svgExport.width * scale));
        canvas.height = Math.max(1, Math.round(svgExport.height * scale));

        const context = canvas.getContext("2d");
        if (!transparentBackground) {
            context.fillStyle = "#FFFFFF";
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        window.URL.revokeObjectURL(svgURL);
        resolve(canvas);
    };

    image.onerror = () => {
        window.URL.revokeObjectURL(svgURL);
        reject(new Error("Could not render the workspace screenshot."));
    };

    image.src = svgURL;
});

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create the image file.")), type, quality);
});

const textBytes = text => new TextEncoder().encode(text);

const concatenateBytes = chunks => {
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;

    for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
    }

    return output;
};

const createPDFWithJPEG = (jpegBytes, imageWidth, imageHeight) => {
    const landscape = imageWidth >= imageHeight;
    const pageWidth = landscape ? 841.89 : 595.28;
    const pageHeight = landscape ? 595.28 : 841.89;
    const margin = 24;
    const scale = Math.min(
        1,
        (pageWidth - (margin * 2)) / imageWidth,
        (pageHeight - (margin * 2)) / imageHeight
    );
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const drawX = (pageWidth - drawWidth) / 2;
    const drawY = (pageHeight - drawHeight) / 2;
    const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ\n`;
    const objectBodies = [
        [textBytes("<< /Type /Catalog /Pages 2 0 R >>")],
        [textBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")],
        [textBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`)],
        [
            textBytes(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),
            jpegBytes,
            textBytes("\nendstream")
        ],
        [textBytes(`<< /Length ${textBytes(content).length} >>\nstream\n${content}endstream`)]
    ];
    const chunks = [textBytes("%PDF-1.4\n")];
    const offsets = [0];
    let byteLength = chunks[0].length;

    objectBodies.forEach((body, index) => {
        const objectNumber = index + 1;
        const objectChunks = [textBytes(`${objectNumber} 0 obj\n`), ...body, textBytes("\nendobj\n")];
        offsets[objectNumber] = byteLength;
        chunks.push(...objectChunks);
        byteLength += objectChunks.reduce((total, chunk) => total + chunk.length, 0);
    });

    const xrefOffset = byteLength;
    let xref = "xref\n0 6\n0000000000 65535 f \n";
    for (let index = 1; index <= 5; index++) {
        xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(textBytes(xref));

    return concatenateBytes(chunks);
};

const saveExportBlob = async (blob, fileName, format) => {
    if (isElectron) {
        const formatNames = {
            svg: "SVG Image",
            png: "PNG Image",
            jpg: "JPEG Image",
            pdf: "PDF Document",
            zip: "ZIP Archive"
        };
        const result = await dialog.showSaveDialog({
            filters: [{ name: formatNames[format], extensions: [format] }],
            defaultPath: fileName
        });

        if (result.canceled) return false;

        const bytes = new Uint8Array(await blob.arrayBuffer());
        await new Promise((resolve, reject) => {
            nodeFS.writeFile(result.filePath, bytes, error => error ? reject(error) : resolve());
        });
        return true;
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    link.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    return true;
};

const exportWorkspaceScreenshot = async format => {
    const buttons = $("#code-share-dialog [data-screenshot-format]");
    buttons.prop("disabled", true);

    try {
        const transparentBackground = format === "png"
            && $("#workspace-screenshot-transparent").prop("checked");
        const svgExport = await createWorkspaceSVG({ transparentBackground });
        const fileName = `${getProjectBaseName()}-blocks.${format}`;
        let blob;

        if (format === "svg") {
            blob = new Blob([svgExport.text], { type: "image/svg+xml;charset=utf-8" });
        } else {
            const canvas = await createRasterCanvas(svgExport, transparentBackground);
            if (format === "png") {
                blob = await canvasToBlob(canvas, "image/png");
            } else if (format === "jpg") {
                blob = await canvasToBlob(canvas, "image/jpeg", 0.94);
            } else if (format === "pdf") {
                const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.94);
                const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
                blob = new Blob([
                    createPDFWithJPEG(jpegBytes, canvas.width, canvas.height)
                ], { type: "application/pdf" });
            } else {
                throw new Error(`Unsupported screenshot format: ${format}`);
            }
        }

        if (await saveExportBlob(blob, fileName, format)) {
            NotifyS(`Workspace screenshot exported as ${format.toUpperCase()}`);
        }
    } catch (error) {
        console.error("Export workspace screenshot failed", error);
        NotifyE(error.message || "Export workspace screenshot failed");
    } finally {
        buttons.prop("disabled", false);
    }
};

const openExportDialog = () => {
    $("#code-share-dialog").css("display", "flex");
    updateSourceExportUI();
    resetExportDialog();
};

$("#code-share").click(function(event) {
    event.preventDefault();
    openExportDialog();
});

$("#share-project-file").click(exportProjectFile);
$("#export-project-package").click(exportProjectPackage);
$("#export-source-code").click(exportSourceCode);
$("#copy-source-code").click(copySourceCode);

$("#code-share-dialog [data-screenshot-format]").click(function() {
    exportWorkspaceScreenshot($(this).attr("data-screenshot-format"));
});

const zoomSharePreview = direction => {
    if (!blocklyWorkspaceShare) return;

    const currentScale = blocklyWorkspaceShare.scale;
    const targetScale = Math.min(2.5, Math.max(0.08,
        Math.round((currentScale + (direction * 0.05)) * 100) / 100));
    if (targetScale === currentScale) return;

    const scaleSpeed = blocklyWorkspaceShare.options.zoomOptions.scaleSpeed;
    const zoomAmount = Math.log(targetScale / currentScale) / Math.log(scaleSpeed);
    blocklyWorkspaceShare.zoomCenter(zoomAmount);
    updateSharePreviewScale();
};

$("#share-preview-zoom-out").click(() => zoomSharePreview(-1));
$("#share-preview-zoom-in").click(() => zoomSharePreview(1));
$("#share-preview-zoom-actual").click(() => {
    if (!blocklyWorkspaceShare) return;

    blocklyWorkspaceShare.setScale(1);
    blocklyWorkspaceShare.scrollCenter();
    updateSharePreviewScale();
});

const sharePreviewStage = $("#code-share-dialog .share-preview-stage")[0];
if (sharePreviewStage) {
    sharePreviewStage.addEventListener("wheel", event => {
        if (!blocklyWorkspaceShare || !$("#code-share-dialog").is(":visible")) return;

        event.preventDefault();
        zoomSharePreview(event.deltaY < 0 ? 1 : -1);
    }, { passive: false });
}

$("#code-share-dialog .close-btn").click(() => $("#code-share-dialog").hide());

$("#code-share-dialog").click(function(event) {
    if (event.target === this) $(this).hide();
});
