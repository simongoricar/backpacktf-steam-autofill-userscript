// ==UserScript==
// @name        backpack.tf Auto-fill Integration
// @namespace   https://github.com/DefaultSimon
// @description An integration with Improved HusKy's Steam Trade Offer Enhancer. Automatically adds the required amount of currency on your side.
// @include     https://backpack.tf/classifieds*
// @include     https://backpack.tf/stats/*
// @version     1.0.2
// @author      DefaultSimon
// @updateURL   https://raw.githubusercontent.com/DefaultSimon/backpacktf-steam-autofill-userscript/master/backpacktf-improved-trade-integration.user.js
// @downloadURL https://raw.githubusercontent.com/DefaultSimon/backpacktf-steam-autofill-userscript/master/backpacktf-improved-trade-integration.user.js
// @run-at      document-idle
// ==/UserScript==

/// CHANGELOG
// 1.0.2
//  - Support for 1.5.2 of the Improved Steam Trade Offer Enhancer userscript (what a name).
//
// 1.0.1
//  - Improve currency detection
//  - Improve UI elements
//

/**
 * Convert a (possibly decimal) value of refined into refined, reclaimed and scrap.
 * Example: 1.66 would return [1, 2, 0] (1 ref, 2 scrap)
 */
function refDecimalToRefRecScrap (value) {
    const flooredRef = Math.floor(value);
    let remaining = value - flooredRef;

    let ref = flooredRef;
    let rec = 0;
    let scrap = 0;

    // Process the decimal places
    // + 0.01 corrections to fix the floating point errors
    while ((remaining + 0.01) >= 0.11) {
        if ((remaining + 0.01) >= 0.33) {
            remaining -= 0.33;
            rec += 1;
        } else if ((remaining + 0.01) >= 0.11) {
            remaining -= 0.11;
            scrap += 1;
        }
    }

    return [ref, rec, scrap];
}

jQuery(function () {
    // Append CSS
    const globalCss = `<style type="text/css">
    .bptf-enhancer-currency-status {
        opacity: 0.4;
        font-size: 11px;
        margin-right: 2px;
    }
    /* Fighting specificity */
    .listing-buttons a.bptf-enhancer-done.bptf-enhancer-done {
        background-color: rgb(44,150,108);
        border-color: rgb(32,158,108);
        box-shadow: rgb(17,112,74) 1px -1px 10px -4px;
    }
    .listing-buttons a.bptf-enhancer-inaccurate.bptf-enhancer-inaccurate {
        background-color: rgb(150,99,44);
        border-color: rgb(158,97,32);
        box-shadow: rgb(112,66,17) 1px -1px 10px -4px;
    }
    </style>`;
    jQuery(globalCss).appendTo("head");

    const descriptionCurrencyRegex = /(\d+(?:\.\d+)?)\s?(keys?|ref)/iug;

    // Gather all classifields on the page
    const orderColumns = jQuery(".media-list");

    const sellOrders = jQuery(orderColumns[0]).find(".listing");
    const buyOrders = jQuery(orderColumns[1]).find(".listing");

    function processClassifield(JQElement, orderType) {
        let currencyString = JQElement.find(".tag.bottom-right span").text();
        let descriptionString = JQElement.find(".quote-box p").text();

        let currencyInfo = currencyString.split(" ");
        if (currencyInfo.length !== 2) {
            console.warn("currencyInfo has length " + currencyInfo.length + ": " + currencyString);
            return;
        }

        const currencyAmount = parseFloat(currencyInfo[0]);
        const currencyType = currencyInfo[1];

        // Add a status indicator
        JQElement.find(".listing-buttons")
          .prepend("<span class='bptf-enhancer-currency-status'></span>");
        const statusElement = JQElement.find(".bptf-enhancer-currency-status");

        statusElement.text("(loading)");

        let totalCurrencyMap = {
            "key": 0,
            "ref": 0,
            "rec": 0,
            "scrap": 0,
        }
        let isAccurate = true;

        if (currencyType === "key" || currencyType === "keys") {
            /*
             CURRENCY: keys
             */
            const flooredKeys = Math.floor(currencyAmount);
            const remaining = currencyAmount - flooredKeys;

            if (remaining === 0) {
                // Purely keys, no need for further calculations
                totalCurrencyMap.key = flooredKeys;
            } else {
                // Process the decimal places

                // Try processing the description first
                const matchesArray = [...descriptionString.matchAll(descriptionCurrencyRegex)];
                if (matchesArray.length === 2) {
                    for (let i = 0; i < matchesArray.length; i++) {
                        const match = matchesArray[i];
                        if (match.length !== 3) {
                            console.warn("Expected legnth 3, got " + match.length + ": " + match + " on \"" + descriptionString + "\".");
                            continue;
                        }

                        let currencyAmount = parseFloat(match[1]);
                        let currencyType = match[2];

                        if (currencyType === "keys" || currencyType === "key") {
                            totalCurrencyMap.key = currencyAmount;
                            // TODO handle cases where the description has decimal places in keys, e.g. "... 14.3 keys"
                        } else if (currencyType === "ref") {
                            const unpackedCurrency = refDecimalToRefRecScrap(currencyAmount);
                            totalCurrencyMap.ref = unpackedCurrency[0];
                            totalCurrencyMap.rec = unpackedCurrency[1];
                            totalCurrencyMap.scrap = unpackedCurrency[2];
                        }
                    }
                } else {
                    // INACCURATE
                    // Fall back to keys, the rest will be up to the user
                    totalCurrencyMap.key = flooredKeys;
                    isAccurate = false;
                }
            }
        } else if (currencyType === "ref") {
            /*
             CURRENCY: ref
             */
            const unpackedCurrency = refDecimalToRefRecScrap(currencyAmount);
            totalCurrencyMap.ref = unpackedCurrency[0];
            totalCurrencyMap.rec = unpackedCurrency[1];
            totalCurrencyMap.scrap = unpackedCurrency[2];
        }

        // Take the calculated value and display it and the UI as well as update the trade link
        let encodedCurrencyArray = [];
        for (let [name, amount] of Object.entries(totalCurrencyMap)) {
            if (amount > 0) {
                encodedCurrencyArray.push(`${amount}${name}`);
            }
        }

        let encodedCurrency = encodedCurrencyArray.join(",");

        // Update the status, add class to trade button and log
        let encodedCurrencyArrayHuman = [];
        for (let [name, amount] of Object.entries(totalCurrencyMap)) {
            if (amount > 0) {
                encodedCurrencyArrayHuman.push(`${amount} ${name}`);
            }
        }
        if (isAccurate) {
            statusElement.text(`(${encodedCurrencyArrayHuman.join(", ")})`)
        } else {
            statusElement.html(`(inaccurate: ${encodedCurrencyArrayHuman.join(", ")})`)
        }

        // Update the link to automatically load the required currency when opened
        const tradeButton = JQElement.find(
          ".listing-buttons a[href^='https://steamcommunity.com/tradeoffer/']"
        );
        const previousHref = tradeButton.attr("href");
        const paramEnhancerAddType = orderType === "self" ? "Self" : "Partner";

        tradeButton.attr("href", `${previousHref}&enhancerAddCurrency${paramEnhancerAddType}=${encodedCurrency}`)

        // Make the trade button look slightly glowy
        tradeButton.addClass(isAccurate ? "bptf-enhancer-done" : "bptf-enhancer-inaccurate");

        // console.log(totalCurrencyMap);
        // console.log("[" + encodedCurrency + "] " + descriptionString);
    }

    // For each one, update the trade link to automatically add required currency
    sellOrders.each(function (index, element) {
        const JQElement = jQuery(element);
        processClassifield(JQElement, "self");
    });

    buyOrders.each(function (index, element) {
        const JQElement = jQuery(element);
        processClassifield(JQElement, "partner");
    });
});
