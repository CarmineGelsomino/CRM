sap.ui.define([
    "sap/ui/core/UIComponent",
    "crm/model/models"
], function (UIComponent, models) {
    "use strict";

    return UIComponent.extend("crm.Component", {
        metadata: {
            manifest: false
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");
            this.setModel(models.createSessionModel(window.CRM_CONFIG.authorized), "session");

            this.getRouter().initialize();
        }
    });
});
