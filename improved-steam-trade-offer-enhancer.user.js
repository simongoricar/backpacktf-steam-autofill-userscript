// ==UserScript==
// @name        Improved Steam Trade Offer Enhancer
// @namespace   https://github.com/DefaultSimon
// @description Userscript to enhance Steam trade offers.
// @include     /^https?:\/\/steamcommunity\.com\/(id|profiles)\/.*\/tradeoffers.*/
// @include     /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
// @version     1.5.4dev
// @author      HusKy, improvements by DefaultSimon
// @updateURL   https://raw.githubusercontent.com/DefaultSimon/backpacktf-steam-autofill-userscript/master/improved-steam-trade-offer-enhancer.user.js
// @downloadURL https://raw.githubusercontent.com/DefaultSimon/backpacktf-steam-autofill-userscript/master/improved-steam-trade-offer-enhancer.user.js
// @run-at      document-idle
// ==/UserScript==

/// CHANGELOG
// 1.5.4
//  - Fix summary dissapearing on click
//  - Fix key/ref/rec/scrap UI showing incorrectly
//  - Fix key/ref/rec/scrap UI counters not updating
//
// 1.5.3
//  - Add "Add keys/ref/rec/scrap" buttons for quickly adding pure currencies
//  - Optimizations and UI improvements
//
//
// 1.5.2
//  - Huge improvement to the auto-add speed! (doesn't manually search anymore)
//  - Renamed auto-add parameters: now "enhancerAddCurrencySelf" and "enhancerAddCurrencyPartner".
//  - Added: when loading a page with auto-add, disable the inventory UI while the script is auto-adding
//
// 1.5.1
//  - Fix auto-add status not showing properly
//  - Add @updateURL for Tampermonkey
//  - Improve speed when using auto-add (now adds immediately as the inventory is loaded)
//
// 1.5
//  - Clean up the code a bit
//  - Added a warning if the user doesn't have enough items (during auto-fill or manually)
//
//
// 1.4.2-patch1
//  - fixed JS warnings
//  - some refactoring
//  - added "enhancerAddCurrency" url parameter to allow automatically adding currency on your side
//    Useful with the "backpack.tf Trade Offer Enhancer integration".
///

/*
 * LOGGER
 * A simple Logger that prepends the instance name.
 * Format: "[LoggerName] <your message>"
 */
const logStyles = [
    "background-color: #D57F2A",
    "color: #000",
    "font-weight: bold",
    "padding: 2px 3px",
    "border-radius: 2px",
].join(";");
const informationalStyles = [
    "color: #81BF40",
].join(";");
const warningStyles = [
    "color: #E0981F",
].join(";");
const errorStyles = [
    "color: #E71748",
].join(";");
const successStyles = [
    "color: #37C865",
].join(";");

class Logger {
    constructor(name) {
        this.name = name;
    }

    _prepare(message, type) {
        // Returns an array of aruments for the logging function

        // Stringify only if it is an object
        const value = message instanceof Object ? JSON.stringify(message) : message;

        let textStyles = null;
        // TODO make this into a map
        if (type === "informational") {
            textStyles = informationalStyles;
        } else if (type === "warning") {
            textStyles = warningStyles;
        } else if (type === "error") {
            textStyles = errorStyles;
        } else if (type === "success") {
            textStyles = successStyles;
        }

        return [`%c${this.name}%c ${value}`, logStyles, textStyles];
    }

    info(message) {
        console.info(...this._prepare(message, "informational"));
    }

    success(message) {
        console.info(...this._prepare(message, "success"));
    }

    debug(message) {
        console.debug(...this._prepare(message, "informational"));
    }

    warn(message) {
        console.warn(...this._prepare(message, "warning"));
    }

    error(message) {
        console.error(...this._prepare(message, "error"));
    }
}

const logger = new Logger("STEAM TRADE ENHANCER");

const params = new URLSearchParams(window.location.search);
function getUrlParameter(parameterName) {
    return params.get(parameterName);
}

/*
 * CONSTANTS
 */

// array of dangerous descriptions
let dangerous_descriptions = [
    {
        tag: "uncraftable",
        description: "Not Usable in Crafting"
    },
    {
        tag: "gifted",
        description: "Gift from:"
    }
];

// array of rare TF2 keys (defindexes)
let rare_TF2_keys = [
    "5049", "5067", "5072", "5073",
    "5079", "5081", "5628", "5631",
    "5632", "5713", "5716", "5717",
    "5762"
];

// TODO make this dynamic (more resilient to change)
const steamImageKeys = "https://community.akamai.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEAaR4uURrwvz0N252yVaDVWrRTno9m4ccG2GNqxlQoZrC2aG9hcVGUWflbX_drrVu5UGki5sAij6tOtQ/96fx96f";
const steamImageRefined = "https://community.akamai.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEbZQsUYhTkhzJWhsO1Mv6NGucF1Ygzt8ZQijJukFMiMrbhYDEwI1yRVKNfD6xorQ3qW3Jr6546DNPuou9IOVK4p4kWJaA/96fx96f";
const steamImageReclaimed = "https://community.akamai.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEbZQsUYhTkhzJWhsO0Mv6NGucF1YJlscMEgDdvxVYsMLPkMmFjI1OSUvMHDPBp9lu0CnVluZQxA9Gwp-hIOVK4sMMNWF4/96fx96f";
const steamImageScrap = "https://community.akamai.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEbZQsUYhTkhzJWhsPZAfOeD-VOn4phtsdQ32ZtxFYoN7PkYmVmIgeaUKNaX_Rjpwy8UHMz6pcxAIfnovUWJ1t9nYFqYw/96fx96f";

const style =
`<style type="text/css">
    .enhanced-trade-offer_summary {
        color: #fff;
        font-size: 10px;
    }

    .warning {
        color: #ff4422;
    }

    .info {
        padding: 1px 3px;
        border-radius: 4px;
        background-color: #1155FF;
        border: 1px solid #003399;
        font-size: 14px;
    }

    .summary_item {
        padding: 3px;
        margin: 0 2px 2px 0;
        background-color: #3C352E;
        background-position: center;
        background-size: 48px 48px;
        background-repeat: no-repeat;
        border: 1px solid;
        font-size: 16px;
        width: 48px;
        height: 48px;
        display: inline-block;
    }

    .summary_badge {
        padding: 1px 3px;
        border-radius: 4px;
        background-color: #0099CC;
        border: 1px solid #003399;
        font-size: 12px;
    }

    #amount_control {
        padding-left: 8px;
    }

    .enhanced-trade-offer_btn {
        border-width: 0;
        border-radius: 2px;
        padding: 3px 11px;

        background-color: black;
        color: white;

        font-size: 12px;
        line-height: 20px;
        cursor: pointer;
        vertical-align: middle;
    }

    .enhanced-trade-offer_btn.big {
        font-size: 14px;
        padding: 2px 14px;
    }

    #headingAddMultipleItems {
        margin-bottom: 4px;
        margin-left: 2px;
    }

    .enhanced-trade-offer_btn-container {
        margin-top: 4px;
        margin-left: 1px;
        font-size: 13px;
    }

    .enhanced-trade-offer_btn-wrapper {
        display: inline-block;
    }

    .enhanced-trade-offer_btn:not(.big) {
        margin-top: 4px;

        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    .enhanced-trade-offer_btn img {
        height: 20px;
        width: auto;
    }

    .enhanced-trade-offer_btn .btn_text {
        margin-left: 8px;
    }

    .enhanced-trade-offer_btn .btn_secondary-text {
        margin-left: 5px;
        opacity: 0.55;
        /* Two digits */
        min-width: 18px;
        display: inline-block;
    }

    #btn_additems {
        margin-left: 5px;
        margin-bottom: 2px;
        font-weight: bold;
    }

    .enhanced-trade-offer_btn.warning {
        background-color: #a44631;
        font-style: italic;
    }

    #itemcount-warning {
        font-size: 0.9rem;
        margin-top: 4px;
        margin-left: 1px;
        min-height: 20px;
    }

    @keyframes autoAddFinished {
        0% { transform: scale(1) }
        60% { transform: scale(1.15) }
        100% { transform: scale(1) }
    }

    .filter_control_ctn.finishedAnimation {
        animation-name: autoAddFinished;
        animation-fill-mode: forwards;
        animation-iteration-count: 3;
        animation-timing-function: cubic-bezier(0.75, 0.25, 0.44, 0.87);
        animation-duration: .35s;
    }

    .autoadd-status-container {
        font-size: 0.9rem;
        margin-left: 1px;
        position: relative;
        top: 6px;
        user-select: none;
    }

    .autoadd-status-container .status {
        font-size: 0.85rem;
        font-weight: bold;
    }
    .autoadd-status-container .status.waiting {
        color: rgb(135,159,203);
    }
    .autoadd-status-container .status.in-progress {
        color: rgb(210,170,255);
    }
    .autoadd-status-container .status.error {
        color: rgb(255,177,170);
    }
    .autoadd-status-container .status.done {
        color: rgb(51,191,41);
    }
    .autoadd-status-container .status.done-error {
        color: rgb(186,191,41);
    }

    .autoadd-inventory-disabled {
        pointer-events: none;
    }

    .autoadd-inventory-disabled::before {
        content: "";
        display: block;
        position: absolute;

        width: calc(100% + 2px);
        height: calc(100% + 2px);

        background-color: rgba(1, 1, 1, 0.65);
        top: -1px;
        bottom: -1px;
        left: -1px;
        right: -1px;

        z-index: 1000;
    }

    /* Quick fixes for the absolute styling above */
    .inventory_user_tabs.autoadd-inventory-disabled,
    #inventory_pagecontrols.autoadd-inventory-disabled {
        position: relative;
    }

</style>`;

const tradeBoxAfterHTML =
`
    <div class="trade_rule selectableNone"></div>
    <div class="item_adder">
        <div id="headingAddMultipleItems" class="selectableNone">Add multiple items:</div>
        <input id="amount_control" class="filter_search_box" type="text" placeholder="16">
        <button id="btn_additems" type="button" class="enhanced-trade-offer_btn big">Add</button>
        <br>

        <div class="enhanced-trade-offer_btn-container">
            <span class="enhanced-trade-offer_btn-wrapper">
                <button id="btn_additems-keys" type="button" class="enhanced-trade-offer_btn">
                    <img alt="Keys" src="${steamImageKeys}">
                    <span class="btn_text">Add keys</span>
                    <sup class="btn_secondary-text">(<span id="btn_additems-keys-left">?</span> left)</sup>
                </button>
            </span>
            <span class="enhanced-trade-offer_btn-wrapper">
                <button id="btn_additems-ref" type="button" class="enhanced-trade-offer_btn">
                    <img alt="Refined" src="${steamImageRefined}">
                    <span class="btn_text">Add ref</span>
                    <sup class="btn_secondary-text">(<span id="btn_additems-ref-left">?</span> left)</sup>
                </button>
            </span>

            <br>

            <span class="enhanced-trade-offer_btn-wrapper">
                <button id="btn_additems-rec" type="button" class="enhanced-trade-offer_btn">
                    <img alt="Reclaimed" src="${steamImageReclaimed}">
                    <span class="btn_text">Add reclaimed</span>
                    <sup class="btn_secondary-text">(<span id="btn_additems-rec-left">?</span> left)</sup>
                </button>
            </span>
            <span class="enhanced-trade-offer_btn-wrapper">
                <button id="btn_additems-scrap" type="button" class="enhanced-trade-offer_btn">
                    <img alt="Scrap" src="${steamImageScrap}">
                    <span class="btn_text">Add scrap</span>
                    <sup class="btn_secondary-text">(<span id="btn_additems-scrap-left">?</span> left)</sup>
                </button>
            </span>
        </div>

        <div id="itemcount-warning"></div>
        <br><br>


        <span class="enhanced-trade-offer_btn-wrapper">
            <button id="btn_clearmyitems" type="button" class="enhanced-trade-offer_btn">Clear my items</button>
        </span>
        <span class="enhanced-trade-offer_btn-wrapper">
            <button id="btn_cleartheiritems" type="button" class="enhanced-trade-offer_btn">Clear their items</button>
        </span>
    </div>
    <div class="trade_rule selectableNone"></div>
    <div class="enhanced-trade-offer_summary"></div>
`;

const currencyRegex = /^(\d+(?:\.\d+)?)([a-zA-Z]+)$/i;

const currencyDefindexes = {
    // https://wiki.alliedmods.net/Team_Fortress_2_Item_Definition_Indexes
    key: 5021,
    ref: 5002,
    rec: 5001,
    scrap: 5000,
}

/*
 * USEFUL FUNCTIONS
 */

function getActiveInventoryItems() {
    return jQuery(".inventory_ctn:visible")
        .find(".itemHolder .item");
}

function collectFilteredInventoryItems(inventoryItems) {
    if (typeof inventoryItems === "undefined" || inventoryItems === null) {
        inventoryItems = getActiveInventoryItems();
    }

    return inventoryItems.filter(function (index, element) {
        return jQuery(element).css("display") !== "none";
    });
}

function collectInventoryItemsWithDefindex(inventoryItems, defindex) {
    if (typeof inventoryItems === "undefined" || inventoryItems === null) {
        inventoryItems = getActiveInventoryItems();
    }

    return inventoryItems.filter(function (index, element) {
        const elementRgItem = element.rgItem;
        const elementDefIndex = parseInt((elementRgItem.app_data || {}).def_index);

        if (typeof elementDefIndex === "undefined") {
            logger.warn(`Error while filtering, something is wrong with rgItem: ${elementRgItem}`)
            console.log(element);
            return false;
        }

        return elementDefIndex === defindex;
    });
}

/**
 * Returns the amount of items the user requested to add.
 */
function getAddItemButtonAmount(defaultAmount) {
    if (typeof defaultAmount === "undefined") {
        defaultAmount = 16;
    }

    const inputAmount = parseInt(jQuery("input#amount_control").val());
    if (isNaN(inputAmount)) {
        return defaultAmount;
    } else {
        return inputAmount;
    }
}

/**
 * Will return a comma-delimited string formatted in a readable way.
 */
function constructMissingCurrencyString (missingCurrencyAmountObject) {
    const missingCurrencyArray = [];
    for (let [key, value] of Object.entries(missingCurrencyAmountObject)) {
        if (value > 0) {
            missingCurrencyArray.push(`${value} ${key}`);
        }
    }

    return missingCurrencyArray.join(", ");
}

/**
 * This will (both visibly and usably) disable:
 * - "Your/Their Inventory" buttons
 * - the inventory contents box
 */
function disableInventoryUI () {
    const elementsToDisable = {
        userTabsElement: document.querySelector(".inventory_user_tabs"),
        appSelectElement: document.getElementById("appselect"),
        inventoriesElement: document.getElementById("inventories"),
        inventoryPageControlsElement: document.getElementById("inventory_pagecontrols"),
    };

    // Set "pointer-events: none" and darken all of them
    // (add "autoadd-inventory-disabled" class)
    Object.entries(elementsToDisable).forEach(
        function (entry) {
            entry[1].classList.add("autoadd-inventory-disabled");
        }
    );
    logger.info(`Disabled UI elements: ${Object.keys(elementsToDisable).join(", ")}`)
}


function enableInventoryUI () {
    const elementsToDisable = {
        userTabsElement: document.querySelector(".inventory_user_tabs"),
        appSelectElement: document.getElementById("appselect"),
        inventoriesElement: document.getElementById("inventories"),
        inventoryPageControlsElement: document.getElementById("inventory_pagecontrols"),
    };

    // Remove "autoadd-inventory-disabled" class
    Object.entries(elementsToDisable).forEach(
        function (entry) {
            entry[1].classList.remove("autoadd-inventory-disabled");
        }
    );
    logger.success(`Enabled UI elements: ${Object.keys(elementsToDisable).join(", ")}`)
}

/**
 * This function will wrap the passed function with debounce.
 */
function withDebounce(func, timeout) {
    let debounceTimeout;
    return function () {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(func, timeout);
    }
}

const tradeOfferPage = {
    evaluate_items: function (items) {
        let result = {};

        result._total = items.find("div.trade_item").length;

        items.find("div.trade_item").each(function () {
            let img = jQuery(this).find("img").attr("src");
            let quality = jQuery(this).css("border-top-color");

            if (result[img] === undefined) {
                result[img] = {};
            }

            if (result[img][quality] === undefined) {
                result[img][quality] = 1;
            } else {
                result[img][quality]++;
            }
        });

        return result;
    },

    dump_summary: function (tradeoffer, type, items) {
        if (items._total <= 0) {
            return;
        }

        let htmlString = `Summary (${items._total} ${items._total === 1 ? "item" : "items"}):<br>`;

        for (let prop in items) {
            if (prop === "_total") {
                continue
            }

            let item_type = items[prop];
            for (let quality in item_type) {
                htmlString +=
                  `<span
                    class="summary_item"
                    style="background-image: url('${prop}'); border-color: ${quality}">
                        <span class="summary_badge">${item_type[quality]}</span>
                    </span>`;
            }
        }

        htmlString += "<br><br>Items:<br>";
        tradeoffer
          .find(`div.${type} > div.tradeoffer_items_header`)
          .after(`<div class="enhanced-trade-offer_summary">${htmlString}</div>`);
    },

    attach_links: function (tradeoffer) {
        let avatar =
          tradeoffer
          .find("div.tradeoffer_items.primary")
          .find("a.tradeoffer_avatar");

        if (avatar.length > 0) {
            let profileUrl =
                avatar
                .attr("href")
                .match(/^https?:\/\/steamcommunity\.com\/(id|profiles)\/(.*)/);

            if (profileUrl) {
                tradeoffer
                  .find("div.tradeoffer_footer_actions")
                  .append(` | <a class="whiteLink" target="_blank" href="https://rep.tf${profileUrl[2]}">rep.tf</a>`);
            }
        }
    }
};

const tradeOfferWindow = {
    evaluate_items: function (items) {
        let result = {};
        result._total = 0;
        result._warnings = [];

        let slot_inner = items.find("div.slot_inner");

        slot_inner.each(function () {
            if (jQuery(this).html() !== "" && jQuery(this).html() !== null) {
                result._total++;
                let item = jQuery(this).find("div.item");

                let img = item.find("img").attr("src");
                let quality = item.css("border-top-color");

                if (result[img] === undefined) {
                    result[img] = {};
                }

                if (result[img][quality] === undefined) {
                    result[img][quality] = 1;
                } else {
                    result[img][quality]++;
                }

                // let's check item's info
                let appid = item[0].id.split("_")[0].replace("item", "");
                let contextid = item[0].id.split("_")[1];
                let assetid = item[0].id.split("_")[2];

                let inventory_item;
                if (items[0].id === "your_slots") {
                    inventory_item = unsafeWindow
                      .g_rgAppContextData[appid]
                      .rgContexts[contextid]
                      .inventory
                      .rgInventory[assetid];
                } else {
                    inventory_item = unsafeWindow
                      .g_rgPartnerAppContextData[appid]
                      .rgContexts[contextid]
                      .inventory
                      .rgInventory[assetid];
                }

                let descriptions = inventory_item.descriptions;
                let appdata = inventory_item.app_data;
                let fraudwarnings = inventory_item.fraudwarnings;

                let warning_text;

                if (typeof descriptions === "object") {
                    descriptions.forEach(function (d1) {
                        dangerous_descriptions.forEach(function (d2) {
                            if (d1.value.indexOf(d2.description) > -1) {
                                let warning_text = "Offer contains " + d2.tag + " item(s).";
                                if (result._warnings.indexOf(warning_text) === -1)
                                    result._warnings.push(warning_text);
                            }
                        });
                    });
                }

                if (typeof appdata === "object" && typeof appdata.def_index === "string") {
                    if (rare_TF2_keys.indexOf(appdata.def_index) > -1) {
                        warning_text = "Offer contains rare TF2 key(s).";
                        if (result._warnings.indexOf(warning_text) === -1) {
                            result._warnings.push(warning_text);
                        }
                    }
                }

                if (typeof fraudwarnings === "object") {
                    fraudwarnings.forEach(function (text) {
                        if (text.indexOf("restricted gift") > -1) {
                            warning_text = "Offer contains restricted gift(s).";
                            if (result._warnings.indexOf(warning_text) === -1) {
                                result._warnings.push(warning_text);
                            }
                        }
                    });
                }

            }
        });

        return result;
    },

    dump_summary: function (target, type, items) {
        if (items._total <= 0) return;

        let htmlString = `${type} summary (${items._total} ${items._total === 1 ? "item": "items"}):<br>`;

        // item counts
        for (let prop in items) {
            if (prop.indexOf("_") === 0) {
                continue
            }

            let item_type = items[prop];
            for (let quality in item_type) {
                htmlString += `
                    <span
                    class="summary_item"
                    style="background-image: url('${prop}'); border-color: ${quality};">
                        <span class="summary_badge">
                            ${item_type[quality]}
                        </span>
                    </span>
                `;
            }
        }

        // warnings
        if (items._warnings.length > 0) {
            htmlString += "<span class=\"warning\"><br>Warning:<br>";
            items._warnings.forEach(function (warning, index) {
                htmlString += warning;

                if (index < items._warnings.length - 1) {
                    htmlString += "<br>";
                }
            });
            htmlString += "</span>";
        }

        target.append(htmlString);
    },

    summarise: function () {
        let target = jQuery("div.enhanced-trade-offer_summary");
        target.html("");

        let mine = jQuery("div#your_slots");
        let other = jQuery("div#their_slots");

        let my_items = this.evaluate_items(mine);
        let other_items = this.evaluate_items(other);

        this.dump_summary(target, "My", my_items);
        if (other_items._total > 0) target.append("<br><br>");
        this.dump_summary(target, "Their", other_items);
    },

    init: function () {
        let self = this;

        // something is loading
        let isReady = jQuery("img[src$='throbber.gif']:visible").length <= 0;

        // our partner's inventory is also loading at this point
        let itemParamExists = getUrlParameter("for_item") !== null;
        let hasBeenLoaded = true;

        if (itemParamExists) {
            // format: for_item=<appId>_<contextId>_<itemId>
            let item = getUrlParameter("for_item").split("_");
            hasBeenLoaded = jQuery("div#inventory_" + UserThem.strSteamId + "_" + item[0] + "_" + item[1]).length > 0;
        }

        if (isReady && (!itemParamExists || hasBeenLoaded)) {
            setTimeout(function () {
                self.summarise();
            }, 500);

            return;
        }

        if (itemParamExists && hasBeenLoaded) {
            setTimeout(self.deadItem.bind(self), 5000);
            return;
        }

        setTimeout(function () {
            self.init();
        }, 250);
    },

    deadItem: function () {
        let deadItemExists = jQuery("a[href$='_undefined']").length > 0;
        let item = getUrlParameter("for_item").split("_");

        if (deadItemExists) {
            unsafeWindow.g_rgCurrentTradeStatus.them.assets = [];
            RefreshTradeStatus(g_rgCurrentTradeStatus, true);
            alert("Seems like the item you are looking to buy (ID: " + item[2] + ") is no longer available. You should check other user's backpack and see if it's still there.");
        } else {
            // Something was loading very slowly, restart init...
            this.init();
        }
    },

    clear: function (slots) {
        let timeout = 100;

        let added_items = jQuery(slots);
        let items = added_items.find("div.itemHolder").find("div.item");

        for (i = 0; i < items.length; i++) {
            setTimeout(MoveItemToInventory, i * timeout, items[i]);
        }

        setTimeout(function () {
            tradeOfferWindow.summarise();
        }, items.length * timeout + 500);
    }
};

/*
 * EXECUTED ON DOCUMENT READY
 */
jQuery(function () {
    let location = window.location.pathname;

    // Append CSS styles
    jQuery(style).appendTo("head");

    if (location.indexOf("tradeoffers") > -1) {
        /*
         * PAGE TYPE: Multiple trade offers
         */

        // Retrieve all trade offers.
        let trade_offers = jQuery("div.tradeoffer");

        if (trade_offers.length > 0) {
            trade_offers.each(function () {
                let others = jQuery(this).find("div.primary > div.tradeoffer_item_list");
                let mine = jQuery(this).find("div.secondary > div.tradeoffer_item_list");

                // Evaluate both sides.
                let other_items = tradeOfferPage.evaluate_items(others);
                let my_items = tradeOfferPage.evaluate_items(mine);

                // Dump the summaries somewhere ...
                tradeOfferPage.dump_summary(jQuery(this), "primary", other_items);
                tradeOfferPage.dump_summary(jQuery(this), "secondary", my_items);

                // Check if trade offer is "unavailable"
                // Do this only for /tradeoffers page and nothing else
                let is_ok = location.indexOf("tradeoffers", location.length - "tradeoffers".length) !== -1;
                is_ok = is_ok || location.indexOf("tradeoffers/", location.length - "tradeoffers/".length) !== -1;

                if (is_ok) {
                    // Attach links
                    tradeOfferPage.attach_links(jQuery(this));

                    let is_unavailable = jQuery(this).find("div.tradeoffer_items_banner").text().indexOf("Items Now Unavailable For Trade") > -1;
                    if (is_unavailable) {
                        let trade_offer_id = jQuery(this).attr("id").split("_")[1];
                        let footer = jQuery(this).find("div.tradeoffer_footer");

                        let text = "<span class=\"info\">This trade offer is stuck and invalid, but you can still <strong>decline</strong> it.</span>";
                        footer.prepend("<div class=\"tradeoffer_footer_actions\"><a class=\"whiteLink\" href=\"javascript:DeclineTradeOffer('" + trade_offer_id + "');\">" + text + "</a></div>");
                    }
                }
            });
        }

    } else if (location.indexOf("tradeoffer") > -1) {
        /*
         * PAGE TYPE: Single trade offer window
         */

        // Append custom HTMl content
        jQuery("div.trade_left div.trade_box_contents").append(tradeBoxAfterHTML);

        // Refresh summaries on any user interaction
        // Added debounce for a performance improvement
        // This way, the summary will be drawn after 300ms of idle time (no clicks)
        const bodyElement = jQuery("body");
        bodyElement.click(withDebounce(function () {
            tradeOfferWindow.summarise();
        }, 300));

        // hack to fix empty space under inventory
        // TODO get rid of this if they ever fix it
        setInterval(function () {
            const inventoriesElement = jQuery("div#inventories");

            if (jQuery("#inventory_displaycontrols").height() > 50) {
                if (inventoriesElement.css("marginBottom") === "8px") {
                    inventoriesElement.css("marginBottom", "7px");
                } else {
                    inventoriesElement.css("marginBottom", "8px");
                }
            }
        }, 500);

        // Handle item auto adder
        const inventoryUserTabMyInventoryElement = jQuery("#inventory_select_your_inventory");
        const inventoryUserTabTheirInventoryElement = jQuery("#inventory_select_their_inventory");

        const btnAddItemsElement = jQuery("button#btn_additems");
        const btnAddKeysElement = jQuery("button#btn_additems-keys");
        const btnAddRefElement = jQuery("button#btn_additems-ref");
        const btnAddRecElement = jQuery("button#btn_additems-rec");
        const btnAddScrapElement = jQuery("button#btn_additems-scrap");
        const amountControlElement = jQuery("input#amount_control");

        const btnAddKeysLeftElement = jQuery("#btn_additems-keys-left");
        const btnAddRefLeftElement = jQuery("#btn_additems-ref-left");
        const btnAddRecLeftElement = jQuery("#btn_additems-rec-left");
        const btnAddScrapLeftElement = jQuery("#btn_additems-scrap-left");

        const itemCountWarningElement = jQuery("#itemcount-warning");


        function addItemsToTrade(itemArray, amount) {
            // Add the correct amount of items
            for (let i = 0; i < amount; i++) {
                // i * 50 queues the function calls 50ms apart
                setTimeout(MoveItemToTrade, i * 50, itemArray[i]);
            }

            // This is reached before the MoveItemToTrade functions have even been called
            // This is why here is another timeout, set to trigger 500ms after the final MoveItemToTrade call.
            setTimeout(function () {
                // Refresh summaries
                tradeOfferWindow.summarise();
                runVerifyUserHasEnoughItemsIfInventoryReady();
            }, amount * 50 + 500);
        }

        btnAddItemsElement.click(function () {
            // Do not add items if the offer cannot be modified
            if (jQuery("div.modify_trade_offer:visible").length > 0) return;

            const inventoryItems = collectFilteredInventoryItems();
            let amount = getAddItemButtonAmount(16);
            if (inventoryItems.length < amount) {
                amount = inventoryItems.length;
            }

            addItemsToTrade(inventoryItems, amount);
        });

        btnAddKeysElement.click(function () {
            const inventoryItems = collectInventoryItemsWithDefindex(null, currencyDefindexes.key);
            let amount = getAddItemButtonAmount(16);

            logger.info(`Adding ${amount} keys to trade.`);
            addItemsToTrade(inventoryItems, amount);
        });

        btnAddRefElement.click(function () {
            const inventoryItems = collectInventoryItemsWithDefindex(null, currencyDefindexes.ref);
            let amount = getAddItemButtonAmount(16);

            logger.info(`Adding ${amount} refined to trade.`);
            addItemsToTrade(inventoryItems, amount);
        });

        btnAddRecElement.click(function () {
            const inventoryItems = collectInventoryItemsWithDefindex(null, currencyDefindexes.rec);
            let amount = getAddItemButtonAmount(16);

            logger.info(`Adding ${amount} reclaimed to trade.`);
            addItemsToTrade(inventoryItems, amount);
        });

        btnAddScrapElement.click(function () {
            const inventoryItems = collectInventoryItemsWithDefindex(null, currencyDefindexes.scrap);
            let amount = getAddItemButtonAmount(16);

            logger.info(`Adding ${amount} scrap to trade.`);
            addItemsToTrade(inventoryItems, amount);
        });

        /*
         * Add button UI functions
         */
        function enableAddButton(buttonElement) {
            buttonElement.removeClass("warning");
            buttonElement.prop("disabled", false);
        }

        function disableAddButton(buttonElement) {
            buttonElement.addClass("warning");
            buttonElement.prop("disabled", true);
        }

        /**
         * Will check if the user has enough items.
         * Will not return anything, but will update the UI accordingly.
         */
        function verifyUserHasEnoughItems () {
            const selectedInventoryArray = getActiveInventoryItems();

            // 1) Verify enough items as searched
            const filteredItemsAmount = collectFilteredInventoryItems(selectedInventoryArray).length;
            const amountWanted = getAddItemButtonAmount(16);

            if (amountWanted > filteredItemsAmount) {
                disableAddButton(btnAddItemsElement);
                itemCountWarningElement.html(
                    `<b>Warning:</b> you only have <b>${filteredItemsAmount}</b> items of this type!`
                );
            } else {
                enableAddButton(btnAddItemsElement);
                itemCountWarningElement.text("");
            }

            // 2) Verify enough key/ref/rec/scrap in inventory for the corresponding buttons
            const keysAmount = collectInventoryItemsWithDefindex(selectedInventoryArray, currencyDefindexes.key).length;
            const refAmount = collectInventoryItemsWithDefindex(selectedInventoryArray, currencyDefindexes.ref).length;
            const recAmount = collectInventoryItemsWithDefindex(selectedInventoryArray, currencyDefindexes.rec).length;
            const scrapAmount = collectInventoryItemsWithDefindex(selectedInventoryArray, currencyDefindexes.scrap).length;

            btnAddKeysLeftElement.text(keysAmount);
            btnAddRefLeftElement.text(refAmount);
            btnAddRecLeftElement.text(recAmount);
            btnAddScrapLeftElement.text(scrapAmount);

            enableAddButton(btnAddKeysElement);
            enableAddButton(btnAddRefElement);
            enableAddButton(btnAddRecElement);
            enableAddButton(btnAddScrapElement);

            if (amountWanted > keysAmount) {
                disableAddButton(btnAddKeysElement);
            }
            if (amountWanted > refAmount) {
                disableAddButton(btnAddRefElement);
            }
            if (amountWanted > recAmount) {
                disableAddButton(btnAddRecElement);
            }
            if (amountWanted > scrapAmount) {
                disableAddButton(btnAddScrapElement);
            }
        }

        // Set up functions for multiple MutationObservers to run when the inventory on both sides is loaded
        const inventoryStatusElement = document.getElementById("trade_inventory_unavailable");
        function connectObserver (mutationObserver) {
            mutationObserver.observe(
                inventoryStatusElement,
                {
                    attributes: true,
                }
            )
        }

        function runVerifyUserHasEnoughItemsIfInventoryReady() {
            const inventoryStatusNotLoading = inventoryStatusElement.style.display === "none";
            if (inventoryStatusNotLoading) {
                verifyUserHasEnoughItems();
            }
        }

        amountControlElement.keyup(runVerifyUserHasEnoughItemsIfInventoryReady);
        amountControlElement.change(runVerifyUserHasEnoughItemsIfInventoryReady);
        bodyElement.click(withDebounce(runVerifyUserHasEnoughItemsIfInventoryReady, 80));
        inventoryUserTabMyInventoryElement.click(withDebounce(runVerifyUserHasEnoughItemsIfInventoryReady, 50));
        inventoryUserTabTheirInventoryElement.click(withDebounce(runVerifyUserHasEnoughItemsIfInventoryReady, 50));


        const inventoryChangeObserver = new MutationObserver(runVerifyUserHasEnoughItemsIfInventoryReady);
        connectObserver(inventoryChangeObserver);

        jQuery("button#btn_clearmyitems").click(function () {
            tradeOfferWindow.clear("div#your_slots");
        });

        jQuery("button#btn_cleartheiritems").click(function () {
            tradeOfferWindow.clear("div#their_slots");
        });

        tradeOfferWindow.init();

        let itemParam = getUrlParameter("for_item");
        if (itemParam !== null) {
            let item = itemParam.split("_");

            unsafeWindow.g_rgCurrentTradeStatus.them.assets.push({
                "appid": item[0],
                "contextid": item[1],
                "assetid": item[2],
                "amount": 1
            });

            RefreshTradeStatus(g_rgCurrentTradeStatus, true);
        }

        // Display warnings if you or your trade partner have an escrow
        if (unsafeWindow.g_daysMyEscrow > 0) {
            let hours = unsafeWindow.g_daysMyEscrow * 24;
            jQuery("div.trade_partner_headline")
                .append(
                    `<div class='warning'>
                        (You do not have mobile confirmations enabled.
                        Items will be held for <b>${hours}</b> hours.)
                    </div>`
                );
        }

        if (unsafeWindow.g_daysTheirEscrow > 0) {
            let hours = unsafeWindow.g_daysTheirEscrow * 24;
            jQuery("div.trade_partner_headline")
                .append(
                    `<div class='warning'>
                        (Other user does not have mobile confirmations enabled.
                        Items will be held for <b>${hours}</b> hours.)
                    </div>`
                );
        }


        // Added url parameter to automatically add some currency on your or the other trader's side
        // The parameters are "enhancerAddCurrencySelf" and "enhancerAddCurrencyPartner", the format is:
        //     comma-separated currencies, e.g. "...&enhancerAddCurrencySelf=1key,3.44ref&..."
        //     Supported currencies: "key", "ref", "rec", "scrap"
        //
        // Usage: loading the trade offer page with this parameter set will add
        // the specified amount of currency to your/your trade partner's side automatically.
        // Combine with the backpack.tf integration for maximum efficiency ;)
        // TODO allow for e.g. "4.33ref"? (though this is handled by the bptf integration anyway)

        const enhancerAddCurrencySelfParam = getUrlParameter("enhancerAddCurrencySelf");
        const enhancerAddCurrencyPartnerParam = getUrlParameter("enhancerAddCurrencyPartner");

        // If any of the above url parameters are present, prepare to load the currencies
        if (enhancerAddCurrencySelfParam || enhancerAddCurrencyPartnerParam) {
            let missingCurrencyAmount = {
                key: 0,
                ref: 0,
                rec: 0,
                scrap: 0,
            };
            let hadMissingCurrencyDuringLoad = false;

            /*
             UI ELEMENTS
             */
            let autoAddUIStatus = null;

            function autoAddSetUp() {
                autoAddUIStatus = "waiting";

                let filterContainer = jQuery(".filter_ctn");
                filterContainer.append(
                    `<span class='autoadd-status-container'>
                        <span>Auto-adding currency:</span>
                        <span class="status waiting">waiting for inventory</span>
                    </span>`
                )

                // Also disable the search bar so the user can't accidentally type something
                jQuery(".filter_control_ctn input").prop("disabled", true);

                // Disable the inventory UI
                disableInventoryUI();
            }

            function autoAddInProgress() {
                // If already in-progress (or in-progress error), do not change.
                if (autoAddUIStatus === "in-progress" || autoAddUIStatus === "error") {
                    return;
                }
                autoAddUIStatus = "in-progress";

                // Update the status
                jQuery(".autoadd-status-container .status")
                  .removeClass("waiting done error")
                  .addClass("in-progress")
                  .text("in-progress")
            }

            function autoAddError() {
                autoAddUIStatus = "error";

                jQuery(".autoadd-status-container .status")
                  .removeClass("waiting in-progress done")
                  .addClass("error")
                  .text(
                      `not enough items (missing ${constructMissingCurrencyString(missingCurrencyAmount)})!`
                  );
            }

            function autoAddFinish() {
                logger.success("Auto-adder DONE.");

                // Update the status
                if (hadMissingCurrencyDuringLoad) {
                    autoAddUIStatus = "done-error";
                    jQuery(".autoadd-status-container .status")
                      .removeClass("in-progress error")
                      .addClass("done-error")
                      .text(
                          `done (missing ${constructMissingCurrencyString(missingCurrencyAmount)})!`
                      )
                } else {
                    autoAddUIStatus = "done";
                    jQuery(".autoadd-status-container .status")
                      .removeClass("in-progress")
                      .addClass("done")
                      .text("done")
                }

                // Renable the search bar
                jQuery(".filter_control_ctn input").prop("disabled", false);
                // Show the bump animation
                jQuery(".filter_control_ctn").addClass("finishedAnimation");

                // Re-enable the inventory UI
                enableInventoryUI();
            }

            function processNextMatch(array, index, signalFinishedOnEnd, finishedCallback) {
                if (index >= array.length) {
                    if (signalFinishedOnEnd) {
                        autoAddFinish();
                    }
                    if (finishedCallback) {
                        finishedCallback();
                    }

                    return;
                }

                // Process the currency described at the current index
                try {
                    let matched = array[index].match(currencyRegex);
                    if (matched === null || matched.length !== 3) {
                        logger.warn("Currency format was not recognized: " + array[index]);
                        return processNextMatch(array, index + 1, signalFinishedOnEnd, finishedCallback);
                    }

                    let currencyAmount = parseInt(matched[1]);
                    let currencyType = matched[2];

                    const currencyDefindex = currencyDefindexes[currencyType];
                    if (currencyDefindex === undefined) {
                        logger.warn("Currency format was not recognized: " + array[index]);
                        return processNextMatch(array, index + 1, signalFinishedOnEnd, finishedCallback);
                    }

                    // Filter the inventory to JUST the currency we need
                    // (there is no actual search, it just filters the array)
                    const matchingLoadedItems = collectInventoryItemsWithDefindex(null, currencyDefindex);

                    // Warn the user if they do not have enough items
                    if (currencyAmount > matchingLoadedItems.length) {
                        let missingAmount = currencyAmount - matchingLoadedItems.length;
                        missingCurrencyAmount[currencyType] += missingAmount;

                        hadMissingCurrencyDuringLoad = true;
                        autoAddError();
                    }

                    // Move items
                    const itemAmountToAdd = Math.min(currencyAmount, matchingLoadedItems.length);
                    for (let i = 0; i < itemAmountToAdd; i++) {
                        setTimeout(MoveItemToTrade, i * 50, matchingLoadedItems[i]);
                    }

                    setTimeout(function () {
                        tradeOfferWindow.summarise();
                        return processNextMatch(array, index + 1, signalFinishedOnEnd, finishedCallback);
                    }, currencyAmount * 50 + 100);
                    // }, 1000);
                } catch (e) {
                    logger.error("Something went wrong while automatically adding currency: " + e);
                    return processNextMatch(array, index + 1, signalFinishedOnEnd, finishedCallback);
                }
            }

            autoAddSetUp();
            logger.info("enhancerAddCurrency(Self/Partner) is present, watiting for inventory...");

            let autoAddSelfInventory = null;
            if (enhancerAddCurrencySelfParam) {
                autoAddSelfInventory = enhancerAddCurrencySelfParam.split(",");
            }
            let autoAddSelfFocusFunc = function() {
                jQuery("#inventory_select_your_inventory").click();
            }

            let autoAddOtherInventory = null;
            if (enhancerAddCurrencyPartnerParam) {
                autoAddOtherInventory = enhancerAddCurrencyPartnerParam.split(",");
            }
            let autoAddOtherFocusFunc = function() {
                jQuery("#inventory_select_their_inventory").click();
            }

            const mySteamID = g_steamID;
            const partnerSteamID = g_ulTradePartnerSteamID;
            const appID = 440;

            function isInventoryListReady (userSteamID, inventoryAppID) {
                const loadedInventories = [
                    ...document.querySelectorAll("div.inventory_ctn[id^='inventory_']")
                ];

                const requiredInventoryLoaded = loadedInventories.filter(function (element) {
                    return element.id.startsWith(`inventory_${userSteamID}_${inventoryAppID}`);
                }).length === 1;
                const inventoryStatusNotLoading = inventoryStatusElement.style.display === "none";

                return requiredInventoryLoaded && inventoryStatusNotLoading;
            }

            const myInventoryAvailableObserver = new MutationObserver(function () {
                if (isInventoryListReady(mySteamID, appID)) {
                    myInventoryAvailableObserver.disconnect();
                    logger.success("User inventory is available, running auto-add.");

                    const runAutoAddForOther = function () {
                        if (autoAddOtherInventory !== null) {
                            // Should automatically trigger otherInventoryAvailableObserver
                            // and auto-load the items
                            autoAddOtherFocusFunc();
                        }
                    }

                    // Run the self auto-add task, then run the auto-add for the partner
                    if (autoAddSelfInventory !== null) {
                        autoAddInProgress();
                        processNextMatch(
                            autoAddSelfInventory, 0,
                            autoAddOtherInventory === null,
                            runAutoAddForOther,
                        );

                    } else {
                        runAutoAddForOther();
                    }
                }
            });

            const otherInventoryAvailableObserver = new MutationObserver(function () {
                if (isInventoryListReady(partnerSteamID, appID)) {
                    otherInventoryAvailableObserver.disconnect();
                    logger.success("Trade partner inventory is available, running auto-add.");

                    if (autoAddOtherInventory !== null) {
                        autoAddInProgress();
                        processNextMatch(
                            autoAddOtherInventory, 0,
                            true,
                            function () {
                                autoAddSelfFocusFunc();
                            },
                        );

                    }
                }
            });

            // Connect the MutationObserver(s)
            // This will make sure the auto-adding begins as soon as the inventory is loaded
            connectObserver(myInventoryAvailableObserver);
            connectObserver(otherInventoryAvailableObserver);

        }
    }

});
