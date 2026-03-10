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
            var oTile = oEvent.getSource();

            if (oTile.getId().endsWith("contactsTile")) {
                this.navTo("contacts");
                return;
            }

            if (oTile.getHeader() === "Opportunità" || oTile.getHeader() === "Ticket") {
                MessageToast.show("Modulo " + oTile.getHeader() + " in preparazione");
            }
        }
    });
});
