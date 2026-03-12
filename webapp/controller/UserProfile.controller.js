sap.ui.define([
    "crm/controller/BaseController.controller",
    "crm/model/UserApi",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseController, UserApi, JSONModel, MessageToast) {
    "use strict";

    return BaseController.extend("crm.controller.UserProfile", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");

            this.setModel(new JSONModel({
                busy: false,
                data: {
                    first_name: "",
                    last_name: "",
                    email: "",
                    is_active: 1
                },
                passwordInput: "",
                generatedPassword: ""
            }), "profile");

            this._loadProfile();
        },

        _loadProfile: async function () {
            var oProfileModel = this.getModel("profile");
            var iUserId = this.getModel("session").getProperty("/userId");
            var oBundle = this.getResourceBundle();

            if (!iUserId) {
                MessageToast.show(oBundle.getText("userProfileCurrentUserUnavailable"));
                return;
            }

            oProfileModel.setProperty("/busy", true);

            try {
                var oUser = await UserApi.getUser(iUserId);
                oProfileModel.setProperty("/data", {
                    first_name: oUser.first_name || "",
                    last_name: oUser.last_name || "",
                    email: oUser.email || "",
                    is_active: Number(oUser.is_active) ? 1 : 0
                });
            } finally {
                oProfileModel.setProperty("/busy", false);
            }
        },

        onBack: function () {
            this.navTo("home");
        },


        onActiveSwitchChange: function (oEvent) {
            this.getModel("profile").setProperty("/data/is_active", oEvent.getParameter("state") ? 1 : 0);
        },

        onSaveProfile: async function () {
            var oProfileModel = this.getModel("profile");
            var iUserId = this.getModel("session").getProperty("/userId");
            var oPayload = oProfileModel.getProperty("/data") || {};
            var oBundle = this.getResourceBundle();

            if (!iUserId) {
                MessageToast.show(oBundle.getText("userProfileCurrentUserUnavailable"));
                return;
            }

            oProfileModel.setProperty("/busy", true);
            try {
                await UserApi.updateUser(iUserId, {
                    first_name: (oPayload.first_name || "").trim(),
                    last_name: (oPayload.last_name || "").trim(),
                    email: (oPayload.email || "").trim(),
                    is_active: Number(oPayload.is_active) ? 1 : 0
                });
                this.getModel("session").setProperty("/firstName", (oPayload.first_name || "").trim());
                this.getModel("session").setProperty("/lastName", (oPayload.last_name || "").trim());
                this.getModel("session").setProperty("/email", (oPayload.email || "").trim());
            } finally {
                oProfileModel.setProperty("/busy", false);
            }
        },

        onResetPassword: async function () {
            var oProfileModel = this.getModel("profile");
            var iUserId = this.getModel("session").getProperty("/userId");
            var sPassword = (oProfileModel.getProperty("/passwordInput") || "").trim();
            var oBundle = this.getResourceBundle();

            if (!iUserId) {
                MessageToast.show(oBundle.getText("userProfileCurrentUserUnavailable"));
                return;
            }

            oProfileModel.setProperty("/busy", true);
            try {
                var oResult = await UserApi.resetPassword({
                    user_id: iUserId,
                    new_password: sPassword || undefined
                });
                oProfileModel.setProperty("/generatedPassword", oResult.new_password || "");
                oProfileModel.setProperty("/passwordInput", "");
            } finally {
                oProfileModel.setProperty("/busy", false);
            }
        }
    });
});
