// ==UserScript==
// @name        Steam Trade Offer Enhancer
// @namespace   http://steamcommunity.com/id/H_s_K/
// @description Browser script to enhance Steam trade offers.
// @include     /^https?:\/\/steamcommunity\.com\/(id|profiles)\/.*\/tradeoffers.*/
// @include     /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
// @version     1.4.2-patch2
// @author      HusKy, patches by DefaultSimon
// @downloadURL https://forums.backpack.tf/topic/17946-script-steam-trade-offer-enhancer/
// @downloadURL https://gist.github.com/DefaultSimon/571fe1a9839014cf8db6757c6a4bd19d
// ==/UserScript==

/// CHANGELOG
// 1.4.2-patch2
//  - Clean up the code a bit
//  - TODO warn the user where there are not enough items
//
//
// 1.4.2-patch1
//  - fixed JS warnings
//  - some refactoring
//  - added "enhancerAddCurrency" url parameter to allow automatically adding currency on your side
//    Useful with the "backpack.tf Trade Offer Enhancer integration".
///

const params = new URLSearchParams(window.location.search);

function getUrlParameter(parameterName) {
    return params.get(parameterName);
}

function setItemSearchAndUpdate(searchTerm) {
    // Set the input value
    jQuery("#filter_control").val(searchTerm)

    // Trigger UI update
    let keyupEvent = new Event("keyup");
    document.getElementById("filter_control").dispatchEvent(keyupEvent);
}

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

let tradeOfferPage = {
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
          .after(`<div class="tradeoffer_items_summary">${htmlString}</div>`);
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

let tradeOfferWindow = {
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
        let target = jQuery("div.tradeoffer_items_summary");
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

// Executed on page load
jQuery(function () {
    let location = window.location.pathname;

    // Append CSS styles
    const style = `
        <style type="text/css">
            .tradeoffer_items_summary {
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
            
            .btn_custom {
                border-width: 0;
                background-color: black;
                border-radius: 2px;
                font-family: Arial, serif;
                color: white;
                line-height: 20px;
                font-size: 12px;
                padding: 0 15px;
                vertical-align: middle;
                cursor: pointer;
            }
            
            #headingAddMultipleItems {
                margin-bottom: 4px;
                margin-left: 2px;
            }
            
            .item_adder #btn_additems {
                margin-left: 5px;
                margin-bottom: 2px;
                font-weight: bold;
            }
            
            .item_adder #btn_additems.warning {
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
                60% { transform: scale(1.1) }
                100% { transform: scale(1) }
            }
            
            .filter_control_ctn.finishedAnimation {
                animation-name: autoAddFinished;
                animation-fill-mode: forwards;
                animation-iteration-count: 3;
                animation-timing-function: cubic-bezier(0.75, 0.25, 0.44, 0.87);
                animation-duration: .35s;
            }
            
            .autoadd-status {
                font-size: 0.9rem;
                margin-left: 1px;
                position: relative;
                top: 6px;
            }
        </style>`;
    jQuery(style).appendTo("head");

    if (location.indexOf("tradeoffers") > -1) {
        // Trade offer page with multiple trade offers

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
        // Single trade offer window

        // Append new divs
        jQuery("div.trade_left div.trade_box_contents").append(`
            <div class="trade_rule selectableNone"></div>
            <div class="item_adder">
                <div id="headingAddMultipleItems" class="selectableNone">Add multiple items:</div>
                <input id="amount_control" class="filter_search_box" type="text" placeholder="16">
                <button id="btn_additems" type="button" class="btn_custom">Add</button>
                <div id="itemcount-warning" style="font-size: 0.9rem"></div>
                <br><br>
                <button id="btn_clearmyitems" type="button" class="btn_custom">Clear my items</button>
                <button id="btn_cleartheiritems" type="button" class="btn_custom">Clear their items</button>
            </div>
            <div class="trade_rule selectableNone"></div>
            <div class="tradeoffer_items_summary"></div>
        `);

        // Refresh summaries whenever ...
        jQuery("body").click(function () {
            setTimeout(function () {
                tradeOfferWindow.summarise();
            }, 500);
        });

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

        function collectSearchedItems () {
            let inventory = jQuery("div.inventory_ctn:visible");

            return inventory.find("div.itemHolder").filter(function () {
                return jQuery(this).css("display") !== "none";
            }).find("div.item").filter(function () {
                return jQuery(this).css("display") !== "none";
            });
        }

        function getAddInputAmount () {
            return parseInt(jQuery("input#amount_control").val());
        }

        // Handle item auto adder
        const btnAddItemsElement = jQuery("button#btn_additems");

        btnAddItemsElement.click(function () {
            // Do not add items if the offer cannot be modified
            if (jQuery("div.modify_trade_offer:visible").length > 0) return;

            const items = collectSearchedItems();

            // Get amount value
            let amount = getAddInputAmount();
            if (isNaN(amount)) amount = 16;
            if (items.length < amount) amount = items.length;

            // Add all items
            for (let i = 0; i < amount; i++) {
                setTimeout(MoveItemToTrade, i * 50, items[i]);
            }

            // Refresh summaries
            setTimeout(function () {
                tradeOfferWindow.summarise();
            }, amount * 50 + 500);
        });

        const amountControlElement = jQuery("input#amount_control");

        function checkUserHasEnoughItems () {
            const items = collectSearchedItems();
            const amountWanted = getAddInputAmount() || 0;

            const btnAddItemsElement = jQuery(".item_adder #btn_additems");
            const ItemCountWarningElement = jQuery("#itemcount-warning");

            if (amountWanted > items.length) {
                btnAddItemsElement.addClass("warning");
                btnAddItemsElement.prop("disabled", true);
                ItemCountWarningElement.html(`<b>Warning:</b> you only have <b>${items.length}</b> items of this type!`);
            } else {
                btnAddItemsElement.removeClass("warning");
                btnAddItemsElement.prop("disabled", false);
                ItemCountWarningElement.text("");
            }
        }
        amountControlElement.keyup(checkUserHasEnoughItems);
        amountControlElement.change(checkUserHasEnoughItems);

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

        if (unsafeWindow.g_daysMyEscrow > 0) {
            let hours = unsafeWindow.g_daysMyEscrow * 24;
            jQuery("div.trade_partner_headline").append("<div class='warning'>(You do not have mobile confirmations enabled. Items will be held for <b>" + hours + "</b> hours.)</div>");
        }

        if (unsafeWindow.g_daysTheirEscrow > 0) {
            let hours = unsafeWindow.g_daysTheirEscrow * 24;
            jQuery("div.trade_partner_headline").append("<div class='warning'>(Other user does not have mobile confirmations enabled. Items will be held for <b>" + hours + "</b> hours.)</div>");
        }



        /// Patch 1
        // Add url parameter to automatically add some currency on your side
        // The parameter is named "enhancerAddCurrency" and the format is:
        //     comma-separated currencies, e.g. "...&enhancerAddCurrency=1key,3.44ref&..."
        //     Supported currencies: "key", "ref", "rec", "scrap"
        //
        // Usage: loading the tradeoffer page with this parameter set will add
        // the specified amount of currency to your side automatically.
        // Combine with an external bptf script for maximum efficiency ;)
        const currencyTypeToSearchTermMap = {
            // Search terms to filter to just the keys
            "key": "Mann Co. Supply Crate Key Tool",
            "keys": "Mann Co. Supply Crate Key Tool",
            "ref": "Refined Metal Craft Item",
            "rec": "Reclaimed Metal Craft Item",
            "scrap": "Scrap Metal Craft Item",
        };
        // TODO allow for e.g. "4.33ref" (though this is handled by the bptf integration anyway)

        const enhancerAddCurrencyParam = getUrlParameter("enhancerAddCurrency");
        if (enhancerAddCurrencyParam !== null) {
            const paramArray = enhancerAddCurrencyParam.split(",");
            const currencyRegex = /^(\d+(?:\.\d+)?)([a-zA-Z]+)$/i;

            function setUpAutoAdd() {
                let filterContainer = jQuery(".filter_ctn");
                filterContainer.append(
                  "<span class='autoadd-status'>Auto-adding currency: <b style='color: rgb(135,159,203)'>waiting for page load</b></span>"
                )

                // Also disable the search bar so the user can't accidentally type something
                jQuery(".filter_control_ctn input").prop("disabled", true);
            }

            function inProgressAutoAdd() {
                // Update the status
                jQuery(".autoadd-status").html("Auto-add currency: <b style='color: rgb(210,170,255)'>in-progress</b>")
            }

            function finishAutoAdd() {
                // Clear the search bar
                setItemSearchAndUpdate("");
                // Update the status
                jQuery(".autoadd-status").html("Auto-add currency: <b style='color: rgb(51,191,41)'>done</b>")
                // Renable the search bar
                jQuery(".filter_control_ctn input").prop("disabled", false);
                // Show the bump animation
                jQuery(".filter_control_ctn").addClass("finishedAnimation");
            }

            function processNextMatch(index) {
                if (index >= paramArray.length) {
                    finishAutoAdd();
                    return;
                }

                try {
                    let matched = paramArray[index].match(currencyRegex);
                    if (matched === null || matched.length !== 3) {
                        console.warn("Format was not recognized: " + paramArray[index]);
                        return processNextMatch(index + 1);
                    }

                    let currencyAmount = parseInt(matched[1]);
                    let currencyType = matched[2];

                    let searchTerm = currencyTypeToSearchTermMap[currencyType];
                    if (searchTerm === undefined) {
                        console.warn("Format was not recognized: " + paramArray[i]);
                        return processNextMatch(index + 1);
                    }

                    setItemSearchAndUpdate(searchTerm);
                    setTimeout(function () {
                        // Set amount of such items and trigger the click
                        jQuery("input#amount_control").val(currencyAmount);
                        jQuery("button#btn_additems").trigger("click");

                        setTimeout(function () {
                            return processNextMatch(index + 1);
                        }, currencyAmount * 50 + 500);
                    }, 1000);
                } catch (e) {
                    console.error("Something went wrong while automatically adding currency: " + e);
                    return processNextMatch(index + 1);
                }
            }

            setUpAutoAdd();
            setTimeout(function () {
                console.log("\"enhancerAddCurrency\" is present, running.");
                inProgressAutoAdd();
                processNextMatch(0);
            }, 1200);
        }
    }

});
