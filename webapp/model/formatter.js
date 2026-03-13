sap.ui.define([], function () {
    "use strict";

    function findCategoryInfo(sCategoryKey, aCategories) {
        aCategories = aCategories || [];

        return aCategories.find(function (oCategory) {
            return oCategory.key === sCategoryKey;
        }) || null;
    }

    return {
        contactCategoryText: function (sCategoryKey, aCategories) {
            var oCategoryInfo = findCategoryInfo(sCategoryKey, aCategories);
            return (oCategoryInfo && oCategoryInfo.value) || sCategoryKey || "";
        },

        contactCategoryColorScheme: function (sCategoryKey, aCategories) {
            var oCategoryInfo = findCategoryInfo(sCategoryKey, aCategories);
            return (oCategoryInfo && oCategoryInfo.colorScheme) || 10;
        },

        lookupText: function (sKey, aItems) {
            var oItem = findCategoryInfo(sKey, aItems);
            return (oItem && oItem.value) || sKey || "";
        },

        lookupState: function (sKey, aItems) {
            var oItem = findCategoryInfo(sKey, aItems);
            return (oItem && oItem.state) || "None";
        },

        activityPriorityText: function (sPriority) {
            var mLabels = {
                bassa: "Bassa",
                media: "Media",
                alta: "Alta"
            };

            return mLabels[sPriority] || sPriority || "";
        },

        activityPriorityColorScheme: function (sPriority) {
            var mSchemes = {
                bassa: 8,
                media: 7,
                alta: 4
            };

            return mSchemes[sPriority] || 9;
        },

        activityTypeColorScheme: function (sType) {
            var mSchemes = {
                chiamata: 3,
                evento: 5,
                email: 9,
                altro: 1
            };

            return mSchemes[sType] || 10;
        },

        formatDateTime: function (sValue) {
            if (!sValue) {
                return "";
            }

            var oDate = new Date(String(sValue).replace(" ", "T"));

            if (isNaN(oDate.getTime())) {
                return sValue;
            }

            return oDate.toLocaleString();
        }
    };
});
