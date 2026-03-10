sap.ui.define([
    "crm/controller/BaseController.controller",
    "sap/m/MessageToast"
], function (BaseController, MessageToast) {
    "use strict";

    return BaseController.extend("crm.controller.Home", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");
        },

        onTilePress: function (oEvent) {
            var sModuleName = oEvent.getSource().getHeader();
            MessageToast.show("Modulo " + sModuleName + " in preparazione");
        }
    });
});
