sap.ui.define([
    "crm/controller/BaseController.controller",
    "sap/m/MessageToast"
], function (BaseController, MessageToast) {
    "use strict";

    return BaseController.extend("crm.controller.Home", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");
        },

        onLogout: function () {
            fetch(window.CRM_CONFIG.apiBaseUrl + "/logout.php", {
                method: "POST",
                credentials: "same-origin"
            })
                .then(function () {
                    var oSessionModel = this.getModel("session");
                    oSessionModel.setProperty("/isAuthorized", false);
                    oSessionModel.setProperty("/username", "");
                    MessageToast.show("Logout effettuato");
                    window.location.reload();
                }.bind(this));
        }
    });
});
