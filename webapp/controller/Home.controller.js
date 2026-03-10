sap.ui.define([
    "crm/controller/BaseController.controller",
    "sap/m/MessageToast",
    "sap/m/ActionSheet",
    "sap/m/Button"
], function (BaseController, MessageToast, ActionSheet, Button) {
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
        },

        onNavToHome: function () {
            MessageToast.show(this.getResourceBundle().getText("shellNavHomeFeedback"));
        },

        onMainMenuSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");

            if (!oItem) {
                return;
            }

            if (oItem.getId().endsWith("homeMenuContacts")) {
                this.navTo("contacts");
                return;
            }

            MessageToast.show(this.getResourceBundle().getText("shellMenuFeedback", [oItem.getText()]));
        },

        onNotificationsPress: function () {
            MessageToast.show(this.getResourceBundle().getText("shellNotificationsFeedback"));
        },

        onProductSwitcherPress: function () {
            MessageToast.show(this.getResourceBundle().getText("shellProductSwitcherFeedback"));
        },

        onCopilotPress: function () {
            MessageToast.show(this.getResourceBundle().getText("shellCopilotFeedback"));
        },

        onSearch: function (oEvent) {
            var sQuery = (oEvent.getParameter("query") || "").trim();
            if (!sQuery) {
                MessageToast.show(this.getResourceBundle().getText("shellSearchEmptyFeedback"));
                return;
            }

            MessageToast.show(this.getResourceBundle().getText("shellSearchFeedback", [sQuery]));
        },

        onProfilePress: function (oEvent) {
            if (!this._oProfileActionSheet) {
                this._oProfileActionSheet = new ActionSheet({
                    buttons: [
                        new Button({
                            text: this.getResourceBundle().getText("shellProfileSettings"),
                            icon: "sap-icon://action-settings",
                            press: this.onProfileSettingsPress.bind(this)
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

        onProfileSettingsPress: function () {
            MessageToast.show(this.getResourceBundle().getText("shellProfileSettingsFeedback"));
        },

        onLogout: function () {
            fetch(window.CRM_CONFIG.apiBaseUrl + "/logout.php", {
                method: "POST",
                credentials: "same-origin"
            })
                .then(function () {
                    var oSessionModel = this.getModel("session");
                    oSessionModel.setProperty("/isAuthorized", false);
                    oSessionModel.setProperty("/username", "");
                    oSessionModel.setProperty("/password", "");
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
