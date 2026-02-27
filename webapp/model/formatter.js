sap.ui.define([], function () {
    "use strict";

    return {
        welcomeMessage: function (sUsername, oBundle) {
            if (!oBundle) {
                return "";
            }

            return sUsername ? oBundle.getText("welcomeUser", [sUsername]) : oBundle.getText("welcomeGeneric");
        }
    };
});
