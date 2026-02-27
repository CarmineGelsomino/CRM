sap.ui.define([
    "crm/controller/BaseController",
    "sap/m/MessageToast"
], function (BaseController, MessageToast) {
    "use strict";

    return BaseController.extend("crm.controller.Home", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");
        },

        onLogout: function () {
            fetch("api/logout.php", {
                method: "POST",
                credentials: "same-origin"
            })
                .then(function () {
                    var oSessionModel = this.getModel("session");
                    oSessionModel.setProperty("/isAuthorized", false);
                    oSessionModel.setProperty("/username", "");
                    MessageToast.show(this.getResourceBundle().getText("toastLogoutSuccess"));
                    this.navTo("login", {}, true);
                }.bind(this));
        }
    });
});
