/**
 * @name toByteArray
 * Convert a string to a byte array
 */
function toByteArray(str) {
  let byteArray = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode <= 0xFF) {
      byteArray.push(charcode);
    }
  }
  return byteArray;
}

function fromByteArray(byteArray) {
  return String.fromCharCode.apply(String, byteArray);
}

function crc32(data, value=0) {
  if (data instanceof Array) {
    data = fromByteArray(data);
  }
  let table = [];
  for(let entry, c = 0; c < 256; c++) {
    entry = c;
    for(let k = 0; k < 8; k++) {
      entry = 1 & entry ? 3988292384^entry >>> 1 : entry >>> 1;
    }
    table[c] = entry;
  }
  let n = -1 - value;
  for(let t = 0; t < data.length; t++) {
    n = n >>> 8^table[255 & (n^data.charCodeAt(t))];
  }
  return (-1 ^ n) >>> 0;
}

function zipLongest() {
    var args = [].slice.call(arguments);
    var longest = args.reduce(function(a,b){
        return a.length > b.length ? a : b
    }, []);

    return longest.map(function(_,i){
        return args.map(function(array){return array[i]})
    });
}

class struct {
    static lut = {
      "b": {u: DataView.prototype.getInt8, p: DataView.prototype.setInt8, bytes: 1},
      "B": {u: DataView.prototype.getUint8, p: DataView.prototype.setUint8, bytes: 1},
      "h": {u: DataView.prototype.getInt16, p: DataView.prototype.setInt16, bytes: 2},
      "H": {u: DataView.prototype.getUint16, p: DataView.prototype.setUint16, bytes: 2},
      "i": {u: DataView.prototype.getInt32, p: DataView.prototype.setInt32, bytes: 4},
      "I": {u: DataView.prototype.getUint32, p: DataView.prototype.setUint32, bytes: 4},
      "q": {u: DataView.prototype.getInt64, p: DataView.prototype.setInt64, bytes: 8},
      "Q": {u: DataView.prototype.getUint64, p: DataView.prototype.setUint64, bytes: 8},
    }

    static pack(...args) {
        let format = args[0];
        let pointer = 0;
        let data = args.slice(1);
        if (format.replace(/[<>]/, '').length != data.length) {
            throw("Pack format to Argument count mismatch");
            return;
        }
        let bytes = [];
        let littleEndian = true;
        for (let i = 0; i < format.length; i++) {
            if (format[i] == "<") {
                littleEndian = true;
            } else if (format[i] == ">") {
                littleEndian = false;
            } else {
                pushBytes(format[i], data[pointer]);
                pointer++;
            }
        }

        function pushBytes(formatChar, value) {
            if (!(formatChar in struct.lut)) {
                throw("Unhandled character '" + formatChar + "' in pack format");
            }
            let dataSize = struct.lut[formatChar].bytes;
            let view = new DataView(new ArrayBuffer(dataSize));
            let dataViewFn = struct.lut[formatChar].p.bind(view);
            dataViewFn(0, value, littleEndian);
            for (let i = 0; i < dataSize; i++) {
                bytes.push(view.getUint8(i));
            }
        }

        return bytes;
    };

    static unpack(format, bytes) {
        let pointer = 0;
        let data = [];
        let littleEndian = true;

        for (let c of format) {
            if (c == "<") {
                littleEndian = true;
            } else if (c == ">") {
                littleEndian = false;
            } else {
                pushData(c);
            }
        }

        function pushData(formatChar) {
            if (!(formatChar in struct.lut)) {
                throw("Unhandled character '" + formatChar + "' in unpack format");
            }
            let dataSize = struct.lut[formatChar].bytes;
            let view = new DataView(new ArrayBuffer(dataSize));
            for (let i = 0; i < dataSize; i++) {
              view.setUint8(i, bytes[pointer + i] & 0xFF);
            }
            let dataViewFn = struct.lut[formatChar].u.bind(view);
            data.push(dataViewFn(0, littleEndian));
            pointer += dataSize;
        }

        return data;
    };
}

String.prototype.replaceAt = function(index, character) {
    return this.substr(0, index) + character + this.substr(index + character.length);
};

Array.prototype.replaceAt = function(index, newArray) {
    return this.slice(0, index).concat(newArray).concat(this.slice(index + newArray.length));
};

function* makeFileIterator(content) {
    for (let line of content.split(/\r?\n/)) {
        yield line.trim();
    }
    return '';
}

// Older extensions register generators directly on Blockly.Python/JavaScript.
// Normalize only their block handlers, not the generator's own native methods.
const legacyBlockGeneratorStates = new WeakMap();
const legacyBlockGeneratorStateFor = generator => {
    if (!legacyBlockGeneratorStates.has(generator)) {
        const reserved = new Set();
        for (let owner = generator; owner; owner = Object.getPrototypeOf(owner)) {
            for (const key of Object.getOwnPropertyNames(owner)) reserved.add(key);
        }
        legacyBlockGeneratorStates.set(generator, { reserved, pending: new Map() });
    }
    return legacyBlockGeneratorStates.get(generator);
};
const availableBlockGenerators = () => typeof Blockly === "undefined" ? []
    : [Blockly.Python, Blockly.JavaScript].filter(generator => generator && generator.forBlock);
// Capture the native baseline before any dynamic board/extension script runs.
availableBlockGenerators().forEach(legacyBlockGeneratorStateFor);

const legacyBlockGeneratorHandlers = (generator, state) => new Map(
    Object.getOwnPropertyNames(generator)
        .filter(key => !state.reserved.has(key) && typeof generator[key] === "function")
        .map(key => [key, generator[key]])
);
const snapshotLegacyBlockGenerators = () => availableBlockGenerators().map(generator => {
    const state = legacyBlockGeneratorStateFor(generator);
    return {
        generator,
        state,
        legacy: legacyBlockGeneratorHandlers(generator, state),
        modern: new Map(Object.getOwnPropertyNames(generator.forBlock)
            .map(key => [key, generator.forBlock[key]]))
    };
});
const reconcileLegacyBlockGenerators = snapshots => {
    for (const { generator, state, legacy, modern } of snapshots) {
        const handlers = legacyBlockGeneratorHandlers(generator, state);
        const currentModern = generator.forBlock;
        const hasModern = type => Object.prototype.hasOwnProperty.call(currentModern, type);
        const modernChanged = type => modern.has(type) !== hasModern(type)
            || modern.get(type) !== currentModern[type];

        for (const type of legacy.keys()) {
            if (!handlers.has(type)) state.pending.delete(type);
        }
        for (const [type, handler] of handlers) {
            if (legacy.get(type) === handler) continue;
            if (modernChanged(type)) {
                // A script using both APIs explicitly chose its modern handler.
                state.pending.delete(type);
            } else {
                state.pending.set(type, {
                    handler,
                    modern: currentModern[type],
                    hasModern: hasModern(type)
                });
            }
        }
        for (const [type, pending] of state.pending) {
            if (handlers.get(type) !== pending.handler || modernChanged(type)
                || pending.hasModern !== hasModern(type)
                || pending.modern !== currentModern[type]) {
                state.pending.delete(type);
                continue;
            }
            // Generators may be loaded before their block definitions. Wait for
            // a later script rather than losing that registration permanently.
            if (!Object.prototype.hasOwnProperty.call(Blockly.Blocks, type)) continue;
            currentModern[type] = pending.handler;
            state.pending.delete(type);
        }
    }
};

let dynamicScriptId = 0;
let dynamicScriptQueue = Promise.resolve();

const runJavaScript = (source, sourceName="dynamic-script.js", options={}) => {
    // Snapshot and execute in one queue turn: concurrent extension installs or
    // metadata reads must not attribute another script's handlers to this one.
    const execution = dynamicScriptQueue.then(async () => {
        let executionContext;
        let executionError;
        try {
            if (options.beforeExecute) executionContext = await options.beforeExecute();
            if (typeof source !== "string") throw new Error(`Missing JavaScript source: ${sourceName}`);
            const generatorSnapshots = snapshotLegacyBlockGenerators();
            const errorKey = `__microBlockDynamicScriptError${dynamicScriptId++}`;
            const safeSourceName = String(sourceName).replace(/[\r\n]/g, "");
            const wrappedSource = `try {\n${source}\n} catch (error) { window[${JSON.stringify(errorKey)}] = error; }\n//# sourceURL=${safeSourceName}`;
            const scriptURL = URL.createObjectURL(new Blob([wrappedSource], { type: "text/javascript" }));

            await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                const errorSources = new Set([scriptURL, safeSourceName]);
                try { errorSources.add(new URL(safeSourceName, document.baseURI).href); } catch (error) { /* Diagnostic name only. */ }
                let scriptError;
                let settled = false;
                const captureScriptError = event => {
                    if (errorSources.has(event.filename)) {
                        scriptError = event.error || new Error(event.message || `Unable to execute ${safeSourceName}`);
                    }
                };
                const cleanup = () => {
                    window.removeEventListener("error", captureScriptError);
                    delete window[errorKey];
                    script.remove();
                    URL.revokeObjectURL(scriptURL);
                };
                const finish = error => {
                    if (settled) return;
                    settled = true;
                    try {
                        // Keep valid handlers registered before a runtime error.
                        reconcileLegacyBlockGenerators(generatorSnapshots);
                    } catch (compatibilityError) {
                        error = error || compatibilityError;
                    }
                    cleanup();
                    error ? reject(error) : resolve();
                };
                script.src = scriptURL;
                script.async = false;
                script.onload = () => finish(window[errorKey] || scriptError);
                script.onerror = () => finish(scriptError || new Error(`Unable to load ${safeSourceName}`));
                window.addEventListener("error", captureScriptError);
                try {
                    document.head.appendChild(script);
                } catch (error) {
                    finish(error);
                }
            });
        } catch (error) {
            executionError = error;
            throw error;
        } finally {
            try {
                if (options.afterExecute) await options.afterExecute(executionError, executionContext);
            } catch (hookError) {
                if (!executionError) throw hookError;
                console.warn("Unable to finish JavaScript registration tracking", hookError);
            }
        }
    });
    // A rejected extension must not poison later scripts in the shared queue.
    dynamicScriptQueue = execution.catch(() => {});
    return execution;
};

const evaluateJavaScriptExpression = async (source, sourceName="dynamic-expression.js") => {
    const resultKey = `__microBlockDynamicExpressionResult${dynamicScriptId++}`;
    await runJavaScript(`window[${JSON.stringify(resultKey)}] =\n${source}\n`, sourceName);
    const result = window[resultKey];
    delete window[resultKey];
    return result;
};

const readFileAsDataURL = async filePath => {
    const mimeTypes = {
        ".gif": "image/gif",
        ".jpeg": "image/jpeg",
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".webp": "image/webp"
    };
    const mimeType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    const contents = await readFileAsync(filePath);
    return `data:${mimeType};base64,${contents.toString("base64")}`;
};

// Use one project-first source choice in the toolbox and extension management.
// Keep damaged sources in this inventory so they can still be uninstalled.
const getInstalledExtensionSources = async () => {
    const sources = [];
    const projectIds = new Set(fs.ls("/extension"));
    for (const id of projectIds) {
        const basePath = `/extension/${id}`;
        const extensionPath = `${basePath}/extension.js`;
        try {
            const extensionSource = fs.read(extensionPath);
            sources.push({ id, isProject: true, basePath, extensionPath, extensionSource });
        } catch (error) {
            sources.push({ id, isProject: true, basePath, extensionPath, error });
        }
    }
    if (isElectron) {
        for (const id of nodeFS.ls(sharedObj.extensionDir)) {
            if (projectIds.has(id)) continue;
            const basePath = path.join(sharedObj.extensionDir, id);
            const extensionPath = path.join(basePath, "extension.js");
            try {
                const extensionSource = (await readFileAsync(extensionPath)).toString();
                sources.push({ id, isProject: false, basePath, extensionPath, extensionSource });
            } catch (error) {
                sources.push({ id, isProject: false, basePath, extensionPath, error });
            }
        }
    }
    return sources;
};

const getInstalledExtensionRecords = async () => {
    const records = [];
    for (const source of await getInstalledExtensionSources()) {
        let extension = { name: source.id };
        let icon = `${rootPath}/favicon.png`;
        try {
            if (source.error) throw source.error;
            if (typeof source.extensionSource !== "string") throw new Error("Missing extension.js");
            const metadata = await evaluateJavaScriptExpression(source.extensionSource, source.extensionPath);
            if (!metadata || typeof metadata.name !== "string" || !metadata.name.trim()) {
                throw new Error("Invalid extension metadata");
            }
            extension = metadata;
            if (extension.icon) {
                try {
                    icon = source.isProject ? fs.read(`${source.basePath}/${extension.icon}`) || icon
                        : await readFileAsDataURL(path.join(source.basePath, extension.icon));
                } catch (error) {
                    console.warn(`Could not load icon for extension ${source.id}`, error);
                }
            }
        } catch (error) {
            console.warn(`Could not read installed extension ${source.id} (${source.extensionPath})`, error);
        }
        records.push({ id: source.id, extension, icon, source });
    }
    return records;
};
