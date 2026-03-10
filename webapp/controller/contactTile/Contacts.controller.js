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
            var oComponentModel = this.getOwnerComponent().getModel("contacts");
            if (!oComponentModel) {
                oComponentModel = new JSONModel({
                    contacts: [
                        { id: "C001", firstName: "Mario", lastName: "Rossi", email: "mario.rossi@mail.it", phone: "+39 333 1234567", category: "cliente", status: "attivo" },
                        { id: "C002", firstName: "Giulia", lastName: "Bianchi", email: "giulia.bianchi@mail.it", phone: "+39 347 7654321", category: "partner", status: "prospect" },
                        { id: "C003", firstName: "Luca", lastName: "Verdi", email: "luca.verdi@mail.it", phone: "+39 348 9988776", category: "fornitore", status: "inattivo" }
                    ],
                    activities: [
                        { id: "A001", contactId: "C001", type: "Call", status: "aperta", date: "2026-01-05", description: "Richiamare per offerta" },
                        { id: "A002", contactId: "C001", type: "Meeting", status: "chiusa", date: "2026-01-09", description: "Incontro in sede" },
                        { id: "A003", contactId: "C002", type: "Email", status: "aperta", date: "2026-01-07", description: "Invio presentazione" }
                    ],
                    notes: [
                        { id: "N001", contactId: "C001", title: "Profilo", text: "Cliente con budget alto", createdAt: "2026-01-01" },
                        { id: "N002", contactId: "C001", title: "Esigenze", text: "Preferisce contatto email", createdAt: "2026-01-03" },
                        { id: "N003", contactId: "C002", title: "Partnership", text: "Interessata a collaborazione", createdAt: "2026-01-02" }
                    ],
                    selectedContact: null,
                    filteredActivities: [],
                    filteredNotes: []
                });
                this.getOwnerComponent().setModel(oComponentModel, "contacts");
            }

            this.getView().setModel(oComponentModel, "contacts");
            this._oFilterState = {
                search: "",
                status: "all",
                category: "all",
                sortPath: "lastName",
                descending: false
            };

            this._applyFiltersAndSorting();
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

        onSelectionChange: function (oEvent) {
            var oContext = oEvent.getParameter("listItem").getBindingContext("contacts");
            this.getModel("contacts").setProperty("/selectedContact", Object.assign({}, oContext.getObject()));
        },

        onItemPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("contacts") || oEvent.getParameter("listItem").getBindingContext("contacts");
            var sContactId = oContext.getProperty("id");
            this.navTo("contactDetail", { contactId: sContactId });
        },

        onCreateContact: function () {
            var sFirstName = window.prompt("Nome nuovo contatto:");
            if (!sFirstName) {
                return;
            }

            var sLastName = window.prompt("Cognome nuovo contatto:") || "";
            var oModel = this.getModel("contacts");
            var aContacts = oModel.getProperty("/contacts");
            aContacts.push({
                id: "C" + String(Date.now()).slice(-6),
                firstName: sFirstName,
                lastName: sLastName,
                email: "",
                phone: "",
                category: "cliente",
                status: "prospect"
            });
            oModel.refresh(true);
            this._applyFiltersAndSorting();
            MessageToast.show("Contatto creato");
        },

        onEditContact: function () {
            var oSelected = this.getModel("contacts").getProperty("/selectedContact");
            if (!oSelected) {
                MessageToast.show("Seleziona un contatto da modificare");
                return;
            }

            this.navTo("contactDetail", { contactId: oSelected.id });
        },

        onDeleteContact: function () {
            var oModel = this.getModel("contacts");
            var oSelected = oModel.getProperty("/selectedContact");
            if (!oSelected) {
                MessageToast.show("Seleziona un contatto da eliminare");
                return;
            }

            MessageBox.confirm("Vuoi eliminare il contatto selezionato?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    var aContacts = oModel.getProperty("/contacts").filter(function (oContact) {
                        return oContact.id !== oSelected.id;
                    });

                    oModel.setProperty("/contacts", aContacts);
                    oModel.setProperty("/activities", oModel.getProperty("/activities").filter(function (oActivity) {
                        return oActivity.contactId !== oSelected.id;
                    }));
                    oModel.setProperty("/notes", oModel.getProperty("/notes").filter(function (oNote) {
                        return oNote.contactId !== oSelected.id;
                    }));
                    oModel.setProperty("/selectedContact", null);
                    this._applyFiltersAndSorting();
                    MessageToast.show("Contatto eliminato");
                }.bind(this)
            });
        },

        _applyFiltersAndSorting: function () {
            var oTable = this.byId("contactsTable");
            var oBinding = oTable.getBinding("items");
            if (!oBinding) {
                return;
            }

            var aFilters = [];
            if (this._oFilterState.search) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("firstName", FilterOperator.Contains, this._oFilterState.search),
                        new Filter("lastName", FilterOperator.Contains, this._oFilterState.search),
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
        }
    });
});
