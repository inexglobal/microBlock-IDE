const {app, BrowserWindow, session, protocol} = require('electron');
const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.disableHardwareAcceleration();
if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox');
const finish = (result, exitCode) => {
    const output = JSON.stringify(result, null, 2);
    console.log(output);
    if (process.env.MICROBLOCK_TEST_REPORT) fs.writeFileSync(process.env.MICROBLOCK_TEST_REPORT, output);
    app.exit(exitCode);
};
protocol.registerSchemesAsPrivileged([{scheme:'microblock', privileges:{standard:true, secure:true, supportFetchAPI:true, corsEnabled:true}}]);
app.whenReady().then(async () => {
    const partition = 'extension-owner-recheck-' + Date.now();
    const ses = session.fromPartition(partition);
    // In-memory storage and blocked network keep the user's project, native
    // extensions, serial devices, and saved settings untouched by these tests.
    ses.protocol.registerFileProtocol('microblock', (request, callback) => callback({path:path.join(repoRoot, 'microBlock-IDE', decodeURIComponent(request.url.substr(13)))}));
    ses.webRequest.onBeforeRequest({urls:['http://*/*', 'https://*/*']}, (details, callback) => callback({cancel:true}));
    const win = new BrowserWindow({show:false, width:1200, height:800, webPreferences:{partition, nodeIntegration:false, offscreen:true, backgroundThrottling:false}});
    win.webContents.setUserAgent('microBlock extension regression Chromium/83.0');
    const logs = [];
    win.webContents.on('console-message', (event, level, message) => { if (level >= 2) logs.push(message); });
    try {
        await win.loadURL('microblock://./index.html');
        await new Promise(resolve => setTimeout(resolve, 2500));
        const report = await win.webContents.executeJavaScript(`(async () => {
            const checks = [];
            const check = (name, ok) => { checks.push({name,ok:!!ok}); if (!ok) throw Error(name); };
            const put = (id, name, types, source) => {
                fs.write('/extension/' + id + '/extension.js', JSON.stringify({name, color:'#345678', blocks:types}));
                fs.write('/extension/' + id + '/blocks/defs.JS', source);
            };
            const blockSource = (type, label) => 'Blockly.Blocks[' + JSON.stringify(type) + '] = {init:function(){this.appendDummyInput().appendField(' + JSON.stringify(label) + ');this.setColour(200);this.setPreviousStatement(true);this.setNextStatement(true)}};';
            const legacySource = (type, label) => 'Blockly.Python[' + JSON.stringify(type) + '] = function(){return ' + JSON.stringify(label) + '+String.fromCharCode(10)};';
            const code = type => Blockly.Python.forBlock[type]({});
            const baseDefinition = Blockly.Blocks.math_number;
            const baseGenerator = Blockly.Python.forBlock.math_number;
            put('audit-owner-a', 'Owner A', ['audit_owned'], blockSource('audit_owned','Owned') + legacySource('audit_owned','first'));
            await updataWorkspaceAndCategoryFromvFS(true);
            check('Legacy extension visible after owned reload', !!Blockly.Blocks.audit_owned && code('audit_owned').trim() === 'first');
            const category = () => blocklyWorkspace.getToolbox().getToolboxItems().find(item => item.getName() === 'Owner A');
            blocklyWorkspace.getToolbox().setSelectedItem(category());
            check('Actual flyout displays owned block', blocklyWorkspace.getFlyout().getWorkspace().getTopBlocks(false).some(block => block.type === 'audit_owned'));
            fs.write('/extension/audit-owner-a/blocks/generator.js', 'Blockly.Blocks.audit_owned.xml = ' + JSON.stringify('<block type="audit_owned"></block>') + '; Blockly.Python.audit_owned = function(){return "second"+String.fromCharCode(10)};');
            put('audit-owner-b', 'Owner B', ['audit_owned'], 'Blockly.Blocks.audit_owned.xml = ' + JSON.stringify('<block type="audit_owned" gap="30"></block>') + '; Blockly.Python.audit_owned = function(){return "last"+String.fromCharCode(10)};');
            await updataWorkspaceAndCategoryFromvFS(true);
            check('Multiple legacy overrides retain last extension handler', code('audit_owned').trim() === 'last');
            check('In-place block decoration applied', Blockly.Blocks.audit_owned.xml.includes('gap'));
            const keys = previousExtensionRegistrations.map(record => [record.registry,record.key]);
            check('Ownership records coalesce multiple writes per key', keys.every(([registry,key],index) => keys.findIndex(([other,otherKey]) => registry === other && key === otherKey) === index));
            fs.remove('/extension/audit-owner-b');
            await updataWorkspaceAndCategoryFromvFS(true);
            check('Removing overriding extension exposes remaining version', code('audit_owned').trim() === 'second' && !Blockly.Blocks.audit_owned.xml.includes('gap'));
            fs.remove('/extension/audit-owner-a');
            await updataWorkspaceAndCategoryFromvFS(true);
            check('Removed extension block definition cleaned', !Object.prototype.hasOwnProperty.call(Blockly.Blocks,'audit_owned'));
            check('Removed legacy and modern generators cleaned', !Blockly.Python.audit_owned && !Blockly.Python.forBlock.audit_owned);
            await runJavaScript(blockSource('audit_owned','Unrelated'), 'unrelated.js');
            check('Removed legacy handler cannot resurrect on later definition', !Blockly.Python.forBlock.audit_owned);
            delete Blockly.Blocks.audit_owned;
            put('audit-core', 'Core Override', ['math_number'], 'Blockly.Blocks.math_number = {init:function(){this.appendDummyInput().appendField("override")}}; Blockly.Python.math_number = function(){return ["123",0]};');
            await updataWorkspaceAndCategoryFromvFS(true);
            check('Extension overrides core definition', Blockly.Blocks.math_number !== baseDefinition);
            fs.remove('/extension/audit-core');
            await updataWorkspaceAndCategoryFromvFS(true);
            check('Uninstall restores exact core definition and generator', Blockly.Blocks.math_number === baseDefinition && Blockly.Python.forBlock.math_number === baseGenerator);
            put('audit-partial', 'Partial', ['audit_partial'], blockSource('audit_partial','Partial') + legacySource('audit_partial','partial') + 'throw Error("intentional partial load")');
            await updataWorkspaceAndCategoryFromvFS(true);
            check('Valid partial registrations survive runtime error', !!Blockly.Blocks.audit_partial && code('audit_partial').trim() === 'partial');
            fs.remove('/extension/audit-partial');
            await updataWorkspaceAndCategoryFromvFS(true);
            check('Partial failed registrations removable', !Blockly.Blocks.audit_partial && !Blockly.Python.audit_partial && !Blockly.Python.forBlock.audit_partial);
            put('audit-callback', 'Callback Entries', [], blockSource('audit_callback','Callback') + legacySource('audit_callback','callback'));
            fs.write('/extension/audit-callback/extension.js', '({name:"Callback Entries",color:200,blocks:function(){const good=document.createElement("block");good.setAttribute("type","audit_callback");return [null,document.createElement("block"),good,{},good.cloneNode(true)]}})');
            await updataWorkspaceAndCategoryFromvFS(true);
            const callbackCategory = blocklyWorkspace.getToolbox().getToolboxItems().find(item => item.getName() === 'Callback Entries');
            blocklyWorkspace.getToolbox().clearSelection(); blocklyWorkspace.getToolbox().setSelectedItem(callbackCategory);
            check('Invalid callback serialization cannot discard later siblings', blocklyWorkspace.getFlyout().getWorkspace().getTopBlocks(false).filter(block => block.type === 'audit_callback').length === 2);
            fs.remove('/extension/audit-callback');
            const oldFetch = window.fetch;
            const synthetic = id => ({id,name:id,level:[{name:'Test',blocks:[{name:'Synthetic',color:200,icon:'/favicon.png',blocks:['audit_board_shared']}]}],script:['board.js'],blocks:[],css:[],autoCompletion:[]});
            boards.push(synthetic('audit-board-a'),synthetic('audit-board-b'));
            window.auditBoardLoads = [];
            window.fetch = async (url,...args) => {
                const match = String(url).match(/boards\\/(audit-board-[ab])\\/board.js/);
                if (!match) return oldFetch(url,...args);
                await new Promise(resolve => setTimeout(resolve, match[1].endsWith('a') ? 60 : 5));
                return {status:200,text:async () => 'window.auditBoardLoads.push(' + JSON.stringify(match[1]) + ');' + blockSource('audit_board_shared',match[1]) + legacySource('audit_board_shared',match[1])};
            };
            try {
                boardId='audit-board-a';levelName='Test'; const first = loadBoard();
                await new Promise(resolve => setTimeout(resolve,20));
                boardId='audit-board-b';levelName='Test'; const second = loadBoard();
                await Promise.all([first,second]);
                check('Overlapping board loads finish with latest generator', code('audit_board_shared').trim() === 'audit-board-b');
                check('Board status matches latest queued request', $('#board-name').text() === 'audit-board-b');
                put('audit-board-override','Board Override',['audit_board_shared'],legacySource('audit_board_shared','extension wins'));
                await updataWorkspaceAndCategoryFromvFS(true);
                check('Extension overlays current board generator', code('audit_board_shared').trim() === 'extension wins');
                boardId='audit-board-a';levelName='Test'; await loadBoard();
                check('Board switch reloads extension overlay', code('audit_board_shared').trim() === 'extension wins');
                fs.remove('/extension/audit-board-override'); await updataWorkspaceAndCategoryFromvFS(true);
                check('Removing extension restores new board, not old board', code('audit_board_shared').trim() === 'audit-board-a');
                const realBoard = boards.find(board => board.id === 'openbit');
                boardId=realBoard.id;levelName=realBoard.level[0].name;await loadBoard();
                check('Leaving synthetic board cleans raw and modern board handlers', !Blockly.Blocks.audit_board_shared && !Blockly.Python.audit_board_shared && !Blockly.Python.forBlock.audit_board_shared);
                check('Actual OpenBIT categories survive new loader', blocklyWorkspace.getToolbox().getToolboxItems().some(item => item.getName() === 'Display'));
                const display = blocklyWorkspace.getToolbox().getToolboxItems().find(item => item.getName() === 'Display');
                blocklyWorkspace.getToolbox().setSelectedItem(display);
                check('Actual OpenBIT flyout contains multiple blocks', blocklyWorkspace.getFlyout().getWorkspace().getTopBlocks(false).length > 1);
            } finally { window.fetch = oldFetch; }
            check('Workspace resizes restored after all scenarios', blocklyWorkspace.getFlyout().getWorkspace().resizesEnabled);
            return {checks};
        })().catch(error => ({error:error.stack}))`);
        finish({report, logs:report.error ? logs : []}, report.error ? 1 : 0);
    } catch (error) {
        finish({error:error.stack,logs}, 1);
    }
});
