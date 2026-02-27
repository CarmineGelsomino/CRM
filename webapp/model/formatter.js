sap.ui.define([], function () {
    "use strict";

    return {
        welcomeMessage: function (sUsername) {
            return sUsername ? "Benvenuto, " + sUsername : "Benvenuto";
        }
    };
});
