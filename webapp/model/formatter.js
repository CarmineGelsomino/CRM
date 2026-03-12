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
        }
    };
});
