sap.ui.define([
    "crm/controller/BaseController.controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (BaseController, JSONModel, Filter, FilterOperator, Sorter, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("crm.controller.contactTile.Contacts", {
        onInit: function () {
            var oModel = this.getOwnerComponent().getModel("contacts");
            if (!oModel) {
                oModel = new JSONModel({
                    contacts: [],
                    selectedContact: null,
                    loading: false
                });
                this.getOwnerComponent().setModel(oModel, "contacts");
            }

            this.setModel(oModel, "contacts");
            this._oFilterState = {
                search: "",
                status: "all",
                category: "all",
                sortPath: "last_name",
                descending: false
            };

            this._loadContacts();
        },

        _apiRequest: function (sPath, mOptions) {
            return fetch(window.CRM_CONFIG.apiBaseUrl + "/index.php" + sPath, Object.assign({
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                }
            }, mOptions || {})).then(function (oResponse) {
                return oResponse.json();
            });
        },

        _loadContacts: function () {
            var oModel = this.getModel("contacts");
            oModel.setProperty("/loading", true);

            Promise.all([
                this._apiRequest("?entity=contacts"),
                this._apiRequest("?entity=contact_phones")
            ]).then(function (aResponses) {
                var aContacts = aResponses[0].data || [];
                var aPhones = aResponses[1].data || [];
                var mPrimaryPhoneByContact = {};

                aPhones.forEach(function (oPhone) {
                    if (!mPrimaryPhoneByContact[oPhone.contact_id] || Number(oPhone.is_primary) === 1) {
                        mPrimaryPhoneByContact[oPhone.contact_id] = oPhone.phone;
                    }
                });

                aContacts.forEach(function (oContact) {
                    oContact.phone = mPrimaryPhoneByContact[oContact.id] || "";
                });

                oModel.setProperty("/contacts", aContacts);
                this._applyFiltersAndSorting();
            }.bind(this)).catch(function () {
                MessageBox.error("Errore caricamento contatti.");
            }).finally(function () {
                oModel.setProperty("/loading", false);
            });
        },

        onSearch: function (oEvent) {
            this._oFilterState.search = (oEvent.getParameter("query") || "").trim();
            this._applyFiltersAndSorting();
        },

        onSearchLiveChange: function (oEvent) {
            this._oFilterState.search = (oEvent.getParameter("newValue") || "").trim();
            this._applyFiltersAndSorting();
        },

        onFilterChange: function () {
            this._oFilterState.status = this.byId("statusFilter").getSelectedKey();
            this._oFilterState.category = this.byId("categoryFilter").getSelectedKey();
            this._applyFiltersAndSorting();
        },

        onSortChange: function (oEvent) {
            this._oFilterState.sortPath = oEvent.getSource().getSelectedKey();
            this._applyFiltersAndSorting();
        },

        onToggleSortDirection: function (oEvent) {
            this._oFilterState.descending = oEvent.getParameter("pressed");
            this._applyFiltersAndSorting();
        },

        _applyFiltersAndSorting: function () {
            var oBinding = this.byId("contactsTable").getBinding("items");
            if (!oBinding) {
                return;
            }

            var aFilters = [];
            if (this._oFilterState.search) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("first_name", FilterOperator.Contains, this._oFilterState.search),
                        new Filter("last_name", FilterOperator.Contains, this._oFilterState.search),
                        new Filter("email", FilterOperator.Contains, this._oFilterState.search),
                        new Filter("phone", FilterOperator.Contains, this._oFilterState.search)
                    ],
                    and: false
                }));
            }
            if (this._oFilterState.status !== "all") {
                aFilters.push(new Filter("status", FilterOperator.EQ, this._oFilterState.status));
            }
            if (this._oFilterState.category !== "all") {
                aFilters.push(new Filter("category", FilterOperator.EQ, this._oFilterState.category));
            }

            oBinding.filter(aFilters);
            oBinding.sort(new Sorter(this._oFilterState.sortPath, this._oFilterState.descending));
        },

        onSelectionChange: function (oEvent) {
            var oContact = oEvent.getParameter("listItem").getBindingContext("contacts").getObject();
            this.getModel("contacts").setProperty("/selectedContact", Object.assign({}, oContact));
        },

        onItemPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("contacts") || oEvent.getParameter("listItem").getBindingContext("contacts");
            this.navTo("contactDetail", { contactId: String(oContext.getProperty("id")) });
        },

        onCreateContact: function () {
            this.navTo("contactDetail", { contactId: "new" });
        },

        onEditContact: function () {
            var oSelected = this.getModel("contacts").getProperty("/selectedContact");
            if (!oSelected) {
                MessageToast.show("Seleziona un contatto da modificare");
                return;
            }
            this.navTo("contactDetail", { contactId: String(oSelected.id) });
        },

        onDeleteContact: function () {
            var oSelected = this.getModel("contacts").getProperty("/selectedContact");
            if (!oSelected) {
                MessageToast.show("Seleziona un contatto da eliminare");
                return;
            }

            MessageBox.confirm("Vuoi eliminare il contatto selezionato?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }
                    this._apiRequest("?entity=contacts&id=" + encodeURIComponent(oSelected.id), { method: "DELETE" })
                        .then(function () {
                            MessageToast.show("Contatto eliminato");
                            this._loadContacts();
                        }.bind(this))
                        .catch(function () {
                            MessageBox.error("Eliminazione contatto fallita.");
                        });
                }.bind(this)
            });
        }
    });
});
