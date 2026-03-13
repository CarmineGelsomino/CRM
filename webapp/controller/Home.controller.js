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
            var oBundle = this.getResourceBundle();

            if (oTile.getId().endsWith("calendarTodayTile")) {
                this.navTo("calendarToday");
                return;
            }

            if (oTile.getId().endsWith("contactsTile")) {
                this.navTo("contacts");
                return;
            }

            if (oTile.getId().endsWith("propertiesTile")) {
                this.navTo("properties");
                return;
            }

            MessageToast.show(oBundle.getText("homeModuleInPreparation", [oTile.getHeader()]));
        }
    });
});
