sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/m/ActionSheet",
    "sap/m/Button"
], function (Controller, History, MessageToast, ActionSheet, Button) {
    "use strict";

    return Controller.extend("crm.controller.BaseController", {
        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        },

        getModel: function (sName) {
            return this.getView().getModel(sName);
        },

        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        navTo: function (sName, oParameters, bReplace) {
            this.getRouter().navTo(sName, oParameters, undefined, bReplace);
        },

        onNavBack: function () {
            var sPreviousHash = History.getInstance().getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.navTo("home", {}, true);
            }
        },

        onShellNavHome: function () {
            if ((window.location.hash || "").indexOf("home") > -1) {
                MessageToast.show(this.getResourceBundle().getText("shellNavHomeFeedback"));
                return;
            }

            this.navTo("home");
        },

        onShellMainMenuSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            if (!oItem) {
                return;
            }

            var sText = oItem.getText();
            var oBundle = this.getResourceBundle();

            if (sText === oBundle.getText("shellMenuHome")) {
                this.navTo("home");
                return;
            }

            if (sText === oBundle.getText("shellMenuContacts")) {
                this.navTo("contacts");
                return;
            }

            if (sText === oBundle.getText("shellMenuProperties")) {
                this.navTo("properties");
                return;
            }

            if (sText === oBundle.getText("shellMenuNotes")) {
                this.navTo("notes");
                return;
            }

            if (sText === oBundle.getText("shellMenuProfile")) {
                this.navTo("userProfile");
                return;
            }

            MessageToast.show(oBundle.getText("shellMenuFeedback", [sText]));
        },

        onShellNotificationsPress: function () {
            MessageToast.show(this.getResourceBundle().getText("shellNotificationsFeedback"));
        },

        onShellSearch: function (oEvent) {
            var sQuery = (oEvent.getParameter("query") || "").trim();
            if (!sQuery) {
                MessageToast.show(this.getResourceBundle().getText("shellSearchEmptyFeedback"));
                return;
            }

            MessageToast.show(this.getResourceBundle().getText("shellSearchFeedback", [sQuery]));
        },

        formatUserInitials: function (sFirstName, sLastName, sEmail) {
            var sLeft = (sFirstName || "").trim().charAt(0);
            var sRight = (sLastName || "").trim().charAt(0);

            if (sLeft || sRight) {
                return (sLeft + sRight).toUpperCase();
            }

            return (sEmail || "").trim().charAt(0).toUpperCase();
        },

        onShellProfilePress: function (oEvent) {
            if (!this._oProfileActionSheet) {
                this._oProfileActionSheet = new ActionSheet({
                    buttons: [
                        new Button({
                            text: this.getResourceBundle().getText("shellProfileSettings"),
                            icon: "sap-icon://action-settings",
                            press: this.onShellProfileSettingsPress.bind(this)
                        }),
                        new Button({
                            text: this.getResourceBundle().getText("shellProfileLogout"),
                            type: "Emphasized",
                            icon: "sap-icon://log",
                            press: this.onLogout.bind(this)
                        })
                    ]
                });
                this.getView().addDependent(this._oProfileActionSheet);
            }

            this._oProfileActionSheet.openBy(oEvent.getSource());
        },

        onShellProfileSettingsPress: function () {
            this.navTo("userProfile");
        },

        onLogout: function () {
            fetch(window.CRM_CONFIG.apiBaseUrl + "/logout.php", {
                method: "POST",
                credentials: "same-origin"
            })
                .then(function () {
                    var oSessionModel = this.getModel("session");
                    if (oSessionModel) {
                        oSessionModel.setProperty("/isAuthorized", false);
                        oSessionModel.setProperty("/username", "");
                        oSessionModel.setProperty("/userId", null);
                        oSessionModel.setProperty("/password", "");
                        oSessionModel.setProperty("/firstName", "");
                        oSessionModel.setProperty("/lastName", "");
                        oSessionModel.setProperty("/email", "");
                    }
                    window.location.reload();
                }.bind(this))
                .catch(function () {
                    MessageToast.show(this.getResourceBundle().getText("shellLogoutError"));
                }.bind(this));
        },

        onExit: function () {
            if (this._oProfileActionSheet) {
                this._oProfileActionSheet.destroy();
                this._oProfileActionSheet = null;
            }
        }
    });
});
