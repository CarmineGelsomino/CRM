sap.ui.define([
    "sap/ui/core/UIComponent",
    "crm/model/models"
], function (UIComponent, models) {
    "use strict";

    return UIComponent.extend("crm.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");
            this.setModel(models.createSessionModel(window.CRM_CONFIG.authorized, window.CRM_CONFIG.userId), "session");
            this.setModel(models.createJsonFileModel("crm/model/modelCategoriesContact.json"), "categoriesContact");
            this.setModel(models.createJsonFileModel("crm/model/modelStatesContact.json"), "statesContact");

            var oRouter = this.getRouter();
            oRouter.initialize();

            if (window.CRM_CONFIG.authorized) {
                oRouter.navTo("home", {}, true);
            }
        }
    });
});
