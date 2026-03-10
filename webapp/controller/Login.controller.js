sap.ui.define([
    "crm/controller/BaseController.controller",
    "sap/m/MessageToast"
], function (BaseController, MessageToast) {
    "use strict";

    return BaseController.extend("crm.controller.Login", {
        onInit: function () {
            var oSessionModel = this.getOwnerComponent().getModel("session");
            this.getView().setModel(oSessionModel, "session");
            this._resetValidation();
        },

        onLogin: function () {
            var oViewModel = this.getModel("session");
            var oBundle = this.getResourceBundle();
            var sUsername = (oViewModel.getProperty("/username") || "").trim();
            var sPassword = (oViewModel.getProperty("/password") || "").trim();
            var bValid = true;

            oViewModel.setProperty("/loginMessage", "");
            oViewModel.setProperty("/usernameState", "None");
            oViewModel.setProperty("/passwordState", "None");

            if (!sUsername) {
                oViewModel.setProperty("/usernameState", "Error");
                bValid = false;
            }

            if (!sPassword) {
                oViewModel.setProperty("/passwordState", "Error");
                bValid = false;
            }

            if (!bValid) {
                oViewModel.setProperty("/loginMessage", oBundle.getText("loginValidationError"));
                return;
            }

            fetch(window.CRM_CONFIG.apiBaseUrl + "/login.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({ username: sUsername, password: sPassword })
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    if (data.authorized) {
                        oViewModel.setProperty("/isAuthorized", true);
                        oViewModel.setProperty("/password", "");
                        oViewModel.setProperty("/loginMessage", "");
                        MessageToast.show(oBundle.getText("loginSuccess"));
                        this.navTo("home", {}, true);
                        return;
                    }

                    oViewModel.setProperty("/loginMessage", oBundle.getText("loginUnauthorized"));
                }.bind(this))
                .catch(function () {
                    oViewModel.setProperty("/loginMessage", oBundle.getText("loginRequestError"));
                });
        },

        _resetValidation: function () {
            var oViewModel = this.getModel("session");
            oViewModel.setProperty("/loginMessage", "");
            oViewModel.setProperty("/usernameState", "None");
            oViewModel.setProperty("/passwordState", "None");
        }
    });
});
