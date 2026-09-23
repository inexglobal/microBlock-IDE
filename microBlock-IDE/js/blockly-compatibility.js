// The block-plus-minus plugin reuses Blockly's text_quotes extension to get
// the quote image helpers needed by an empty text_join block. That extension
// also tries to decorate a TEXT field, which text_join does not have, and
// logs a warning for every valid text_join block loaded from XML.
(() => {
    const originalApply = Blockly.Extensions.apply;

    Blockly.Extensions.apply = function(extensionName, block, isMutator) {
        const needsTextJoinQuoteHelpers = extensionName === "text_quotes"
            && block.type === "text_join"
            && !block.getField("TEXT");

        if (!needsTextJoinQuoteHelpers) {
            return originalApply.call(this, extensionName, block, isMutator);
        }

        const helperInputName = "__microblock_text_quotes_helper__";
        block.appendDummyInput(helperInputName).appendField("", "TEXT");

        try {
            return originalApply.call(this, extensionName, block, isMutator);
        } finally {
            block.removeInput(helperInputName);
        }
    };
})();
