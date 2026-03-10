sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function (JSONModel, Device) {
    "use strict";

    return {
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        createJsonFileModel: function (sPath) {
            var oModel = new JSONModel();
            oModel.setDefaultBindingMode("OneWay");
            oModel.loadData(sap.ui.require.toUrl(sPath));
            return oModel;
        },

        createSessionModel: function (isAuthorized, userId) {
            return new JSONModel({
                isAuthorized: !!isAuthorized,
                username: "",
                password: "",
                usernameState: "None",
                passwordState: "None",
                loginMessage: "",
                userId: userId || null
            });
        }
    };
});
