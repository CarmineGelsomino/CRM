sap.ui.define([
    "crm/controller/BaseController",
    "sap/m/MessageToast"
], function (BaseController, MessageToast) {
    "use strict";

    return BaseController.extend("crm.controller.Login", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");
        },

        onLogin: function () {
            var oViewModel = this.getModel("session");
            var sUsername = oViewModel.getProperty("/username");
            var sPassword = oViewModel.getProperty("/password");

            fetch("api/login.php", {
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
                        MessageToast.show("Accesso effettuato");
                        this.navTo("home", {}, true);
                        return;
                    }

                    MessageToast.show("Credenziali non valide");
                }.bind(this))
                .catch(function () {
                    MessageToast.show("Errore durante il login");
                });
        }
    });
});
