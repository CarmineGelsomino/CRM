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

        createSessionModel: function (isAuthorized) {
            return new JSONModel({
                isAuthorized: !!isAuthorized,
                username: "",
                password: "",
                usernameState: "None",
                passwordState: "None",
                loginMessage: ""
            });
        }
    };
});
