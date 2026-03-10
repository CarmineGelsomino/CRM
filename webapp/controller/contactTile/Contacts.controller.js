sap.ui.define([
    "crm/controller/BaseController.controller",
    "crm/model/ContactApi",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem"
], function (
    BaseController,
    ContactApi,
    JSONModel,
    Filter,
    FilterOperator,
    Sorter,
    MessageBox,
    MessageToast,
    Dialog,
    Button,
    Label,
    Input,
    TextArea,
    Select,
    Item,
    ViewSettingsDialog,
    ViewSettingsItem
) {
    "use strict";

    return BaseController.extend("crm.controller.contactTile.Contacts", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");
            this.setModel(new JSONModel({
                searchQuery: "",
                categoryKey: "",
                statusKey: ""
            }), "contactFilters");

            this.setModel(new JSONModel({
                contacts: [],
                selectedContactId: null,
                selectedContact: null,
                busy: false
            }), "contacts");

            this._oSortState = { path: "last_name", descending: false };
            this._loadContacts();
        },

        _loadContacts: async function () {
            var oModel = this.getModel("contacts");
            oModel.setProperty("/busy", true);

            try {
                var aContacts = await ContactApi.listContacts();
                oModel.setProperty("/contacts", aContacts || []);
                oModel.setProperty("/selectedContactId", null);
                oModel.setProperty("/selectedContact", null);
                this.byId("contactsTable").removeSelections(true);
                this._applyFiltersAndSort();
            } catch (oError) {
                // Error feedback is already handled in ContactApi
            } finally {
                oModel.setProperty("/busy", false);
            }
        },

        onFilterChange: function () {
            this._applyFiltersAndSort();
        },

        onClearFilters: function () {
            this.getModel("contactFilters").setData({
                searchQuery: "",
                categoryKey: "",
                statusKey: ""
            });
            this._applyFiltersAndSort();
        },

        _applyFiltersAndSort: function () {
            var oFilterData = this.getModel("contactFilters")?.getData() || {};
            var sQuery = (oFilterData.searchQuery || "").trim();
            var sCategory = (oFilterData.categoryKey || "").trim();
            var sStatus = (oFilterData.statusKey || "").trim();
            var oBinding = this.byId("contactsTable")?.getBinding("items");
            var aFilters = [];

            if (!oBinding) {
                return;
            }

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("first_name", FilterOperator.Contains, sQuery),
                        new Filter("last_name", FilterOperator.Contains, sQuery),
                        new Filter("email", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            if (sCategory) {
                aFilters.push(new Filter("category", FilterOperator.EQ, sCategory));
            }

            if (sStatus) {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }

            oBinding.filter(aFilters, "Application");
            oBinding.sort(new Sorter(this._oSortState.path, this._oSortState.descending));
        },

        onRefreshContacts: async function () {
            await this._loadContacts();
        },

        onOpenSortDialog: function () {
            if (!this._oSortDialog) {
                this._oSortDialog = new ViewSettingsDialog({
                    confirm: this.onSortConfirm.bind(this),
                    sortItems: [
                        new ViewSettingsItem({ key: "last_name", text: "Cognome" }),
                        new ViewSettingsItem({ key: "first_name", text: "Nome" }),
                        new ViewSettingsItem({ key: "email", text: "Email" }),
                        new ViewSettingsItem({ key: "category", text: "Categoria" }),
                        new ViewSettingsItem({ key: "status", text: "Stato" })
                    ]
                });
                this.getView().addDependent(this._oSortDialog);
            }

            this._oSortDialog.open();
        },

        onSortConfirm: function (oEvent) {
            var oSortItem = oEvent.getParameter("sortItem");
            this._oSortState.path = (oSortItem && oSortItem.getKey()) || "last_name";
            this._oSortState.descending = !!oEvent.getParameter("sortDescending");
            this._applyFiltersAndSort();
        },

        onSelectionChange: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem && oItem.getBindingContext("contacts");
            var oData = oContext ? oContext.getObject() : null;
            var oModel = this.getModel("contacts");

            oModel.setProperty("/selectedContact", oData);
            oModel.setProperty("/selectedContactId", oData ? oData.id : null);
        },

        onOpenDetail: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("contacts");
            var oContact = oContext && oContext.getObject();

            if (oContact && oContact.id) {
                this.navTo("contactDetail", { contactId: oContact.id });
            }
        },

        onCreateContact: function () {
            this._openContactDialog("create");
        },

        onEditContact: function () {
            var oContact = this.getModel("contacts").getProperty("/selectedContact");
            if (!oContact) {
                MessageToast.show("Seleziona un contatto da modificare.");
                return;
            }

            this._openContactDialog("edit", oContact);
        },

        onRowEdit: function (oEvent) {
            var oContact = oEvent.getSource().getBindingContext("contacts").getObject();
            this._openContactDialog("edit", oContact);
            oEvent.cancelBubble();
        },

        onDeleteContact: function () {
            var oContact = this.getModel("contacts").getProperty("/selectedContact");
            if (!oContact) {
                MessageToast.show("Seleziona un contatto da eliminare.");
                return;
            }

            this._confirmDeleteContact(oContact);
        },

        onRowDelete: function (oEvent) {
            var oContact = oEvent.getSource().getBindingContext("contacts").getObject();
            this._confirmDeleteContact(oContact);
            oEvent.cancelBubble();
        },

        _confirmDeleteContact: function (oContact) {
            MessageBox.confirm("Eliminare il contatto " + oContact.first_name + " " + oContact.last_name + "?", {
                actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.DELETE,
                onClose: async function (sAction) {
                    if (sAction !== MessageBox.Action.DELETE) {
                        return;
                    }

                    try {
                        await ContactApi.deleteContact(oContact.id);
                        MessageToast.show("Contatto eliminato correttamente.");
                        await this._loadContacts();
                    } catch (oError) {
                        // Error feedback is already handled in ContactApi
                    }
                }.bind(this)
            });
        },

        _openContactDialog: function (sMode, oContact) {
            var bEdit = sMode === "edit";
            var oDialog = new Dialog({
                title: bEdit ? "Modifica contatto" : "Nuovo contatto",
                contentWidth: "32rem",
                resizable: true,
                type: "Message",
                content: [
                    new Label({ text: "Nome", required: true }),
                    new Input("contactFirstName", { value: bEdit ? oContact.first_name : "" }),
                    new Label({ text: "Cognome", required: true }),
                    new Input("contactLastName", { value: bEdit ? oContact.last_name : "" }),
                    new Label({ text: "Email" }),
                    new Input("contactEmail", { type: "Email", value: bEdit ? oContact.email : "" }),
                    new Label({ text: "PEC" }),
                    new Input("contactPecEmail", { type: "Email", value: bEdit ? oContact.pec_email : "" }),
                    new Label({ text: "Categoria" }),
                    new Select("contactCategory", {
                        selectedKey: bEdit ? (oContact.category || "Venditore") : "Venditore",
                        width: "100%",
                        items: {
                            path: "categoriesContact>/",
                            templateShareable: false,
                            template: new Item({ key: "{categoriesContact>key}", text: "{categoriesContact>value}" })
                        }
                    }),
                    new Label({ text: "Stato" }),
                    new Select("contactStatus", {
                        selectedKey: bEdit ? (oContact.status || "Attivo") : "Attivo",
                        width: "100%",
                        items: {
                            path: "statesContact>/",
                            templateShareable: false,
                            template: new Item({ key: "{statesContact>key}", text: "{statesContact>value}" })
                        }
                    }),
                    new Label({ text: "Informazioni generiche" }),
                    new TextArea("contactInfo", { width: "100%", rows: 4, value: bEdit ? (oContact.generic_info || "") : "" })
                ],
                beginButton: new Button({
                    text: "Salva",
                    type: "Emphasized",
                    press: async function () {
                        var oPayload = {
                            first_name: sap.ui.getCore().byId("contactFirstName").getValue().trim(),
                            last_name: sap.ui.getCore().byId("contactLastName").getValue().trim(),
                            email: sap.ui.getCore().byId("contactEmail").getValue().trim(),
                            pec_email: sap.ui.getCore().byId("contactPecEmail").getValue().trim(),
                            category: sap.ui.getCore().byId("contactCategory").getSelectedKey(),
                            status: sap.ui.getCore().byId("contactStatus").getSelectedKey(),
                            generic_info: sap.ui.getCore().byId("contactInfo").getValue()
                        };

                        if (!oPayload.first_name || !oPayload.last_name) {
                            MessageToast.show("Nome e cognome sono obbligatori.");
                            return;
                        }

                        try {
                            if (bEdit) {
                                await ContactApi.updateContact(oContact.id, oPayload);
                                MessageToast.show("Contatto aggiornato correttamente.");
                            } else {
                                await ContactApi.createContact(Object.assign({ user_id: 1 }, oPayload));
                                MessageToast.show("Contatto creato correttamente.");
                            }

                            oDialog.close();
                            await this._loadContacts();
                        } catch (oError) {
                            // Error feedback is already handled in ContactApi
                        }
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "Annulla",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        }
    });
});
