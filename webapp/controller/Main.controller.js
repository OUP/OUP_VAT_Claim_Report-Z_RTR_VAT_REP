sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
  ],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */
  function (Controller, JSONModel, Filter, FilterOperator, Spreadsheet) {
    "use strict";

    let _oViewModel = new JSONModel();
    let _oVatReportModel = new JSONModel();
    let _oVatReportDownloadModel = new JSONModel();
    let _oView;
    let _smartFilterBar;
    let _oDataModel;

    return Controller.extend("oup.rtr.vatclaimreport.controller.Main", {
      onInit: function () {
        // view
        _oView = this.getView();

        // odata model
        _oDataModel = this.getOwnerComponent().getModel();

        // Model used to manipulate control states
        const oData = {
          messageType: "None",
          messageText: "Test",
          messageVisible: false,
          action: "Report",
          filterStatus: "",
          sourceName: "",
        };

        // set data to model
        _oViewModel.setData(oData);

        // set view model
        _oView.setModel(_oViewModel, "oViewModel");
        _oView.setModel(_oVatReportModel, "oVatReportModel");
        _oView.setModel(_oVatReportDownloadModel, "oVatReportDownloadModel");

        // smart filter bar
        _smartFilterBar = _oView.byId("smartFilterBar");

        // apply content density mode to root view
        _oView.addStyleClass(this.getOwnerComponent().getContentDensityClass());
      },

      onFilterBarInitialized: function () {
        // trigger search with default filters
        _smartFilterBar.fireSearch();
      },

      /**
       * Getter for the resource bundle.
       * @public
       * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
       */
      getResourceBundle: function () {
        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
      },

      onAssignedFiltersChanged: function () {
        if (_smartFilterBar) {
          var sText = _smartFilterBar.retrieveFiltersWithValuesAsText();

          _oViewModel.setProperty("/filterStatus", sText);
        }
      },

      onExportPress: function () {
        var sSourceName = _oViewModel.getProperty("/sourceName");
        var sTableId =
          sSourceName === "BT"
            ? "idVatReportTable"
            : "idVatReportDownloadTreeTable";
        let oBinding;
        let dataSource;
        let fileName;

        const fnCreateColumns = () => {
          let aColumns = [];

          if (sSourceName === "BT") {
            aColumns = [
              {
                label: "Box Number",
                property: "BoxDes",
              },
              {
                label: "Description",
                property: "BoxTitle",
              },
              {
                label: "Amount",
                property: "Amount",
                scale: 2,
              },
              {
                label: "Currency",
                property: "Waers",
              },
            ];
          } else {
            aColumns = [
              {
                label: "Box Number",
                property: "BoxDes",
              },
              {
                label: "Description",
                property: "BoxTitle",
              },
              {
                label: "Company Code",
                property: "CompanyCode",
              },
              {
                label: "Tax Code/ Module Type",
                property: "TaxCode",
              },
              {
                label: "VAT Percentage",
                property: "VatPercent",
              },
              {
                label: "Amount",
                property: "Amount",
                scale: 2,
              },
              {
                label: "Currency",
                property: "Waers",
              },
            ];
          }

          return aColumns;
        };

        if (sSourceName === "BT") {
          oBinding = _oView.byId(sTableId).getBinding("items");
          dataSource = oBinding
            .getModel("oVatReportModel")
            .getProperty(oBinding.getPath());
          fileName = "OUP VAT Claim Report - Totals.xlsx";
        } else {
          oBinding = _oView.byId(sTableId).getBinding("rows");
          dataSource = oBinding
            .getModel("oVatReportDownloadModel")
            .getProperty(oBinding.getPath());
          fileName = "OUP VAT Claim Report - Source Entites.xlsx";
        }

        new Spreadsheet({
          workbook: {
            columns: fnCreateColumns(),
          },
          dataSource,
          fileName,
        }).build();
      },

      onFilterBarGoPress: function () {
        // get filters from filterbar
        var filters = this._getFilters();

        // success call back function
        const success = (oDataResponse) => {
          let aData = oDataResponse.results || [];
          let aVatReturn = [];

          // sort by box description
          aData.sort(function (a, b) {
            if (a.BoxDes < b.BoxDes) {
              return -1;
            }
            if (a.BoxDes > b.BoxDes) {
              return 1;
            }
            return 0;
          });

          // save result data
          _oVatReportDownloadModel.setData(JSON.parse(JSON.stringify(aData)));

          const fnGroupBy = (list, keyGetter) => {
            const map = new Map();
            list.forEach((item) => {
              const key = keyGetter(item);
              const collection = map.get(key);
              if (!collection) {
                map.set(key, [item]);
              } else {
                collection.push(item);
              }
            });
            return map;
          };

          const mGroupData = fnGroupBy(aData, (oData) => oData.BoxNum);

          mGroupData.forEach((aBox, sKey) => {
            const iAmountTotal = aBox.reduce(function (a, b) {
              return a + parseFloat(b.Amount);
            }, 0);

            const iVatPercentTotal = aBox.reduce(function (a, b) {
              return a + parseFloat(b.VatPercent);
            }, 0);

            let sBoxDesc = aBox[0].BoxDes;
            let sBoxTitle = aBox[0].BoxTitle;

            for (var i = 0, iLen = aBox.length; i < iLen; i++) {
              // clear box description in child elements
              aBox[i].BoxDes = "";

              // clear box title in child elements
              aBox[i].BoxTitle = "";

              // change vat percent to fixed decimal 2
              aBox[i].VatPercent = parseFloat(aBox[i].VatPercent).toFixed(2);

              // parse amount to float
              aBox[i].Amount = parseFloat(aBox[i].Amount);
            }

            const oBox = {
              Amount: iAmountTotal,
              BoxNum: sKey,
              BoxDes: sBoxDesc,
              BoxTitle: sBoxTitle,
              Waers: "", // aBox[0].Waers,
              CompanyCode: "", // aBox[0].CompanyCode,
              TaxCode: "", // aBox[0].TaxCode,
              VatPercent: "", // iVatPercentTotal.toFixed(2),
              boxes: aBox,
            };

            aVatReturn.push(oBox);
          });

          _oVatReportModel.setData(aVatReturn);
        };

        // error call back function
        const error = (oError) => {};

        // trigger request to backend
        _oDataModel.read("/VAT_REPORTSet", {
          filters,
          success,
          error,
        });
      },

      _getFilters: function () {
        const aFilters = [];

        const fnGetValuesFromControl = (oControl, sProperty) => {
          const sControlName = oControl.getMetadata().getName();
          let oFilter;

          if (
            sControlName === "sap.ui.comp.smartfilterbar.SFBMultiInput" ||
            sControlName === "sap.m.MultiInput" ||
            sControlName === "sap.m.MultiComboBox"
          ) {
            let aTokens;

            // get selected items in multi combobox
            if (sControlName === "sap.m.MultiComboBox") {
              aTokens = oControl.getSelectedItems();
            }
            // get selected tokens in multi input
            else {
              aTokens = oControl.getTokens();
            }

            const iLen = aTokens.length;
            let i = 0;

            if (iLen === 1) {
              oFilter = new Filter(
                sProperty,
                FilterOperator.EQ,
                aTokens[0].getKey()
              );
            } else if (iLen > 1) {
              let aFilterTokens = [];

              for (i; i < iLen; i++) {
                aFilterTokens.push(
                  new Filter(sProperty, FilterOperator.EQ, aTokens[i].getKey())
                );
              }

              // add the multi input tokens to a filter
              oFilter = new Filter({
                filters: aFilterTokens,
                and: false,
              });
            }
          } else if (sControlName === "sap.m.Input") {
            // check if input value available
            if (oControl.getValue()) {
              oFilter = new Filter(
                sProperty,
                FilterOperator.EQ,
                oControl.getValue()
              );
            }
          } else if (
            sControlName === "sap.m.ComboBox" ||
            sControlName === "sap.m.Select"
          ) {
            // check if input value available
            if (oControl.getSelectedKey()) {
              oFilter = new Filter(
                sProperty,
                FilterOperator.EQ,
                oControl.getSelectedKey()
              );
            }
          }

          return oFilter;
        };

        // all filter items
        const aFilterItems = _smartFilterBar.getFilterGroupItems();

        for (let i = 0, iLen = aFilterItems.length; i < iLen; i++) {
          if (aFilterItems[i].getVisibleInFilterBar()) {
            let oControl = sap.ui.getCore().byId(aFilterItems[i]._sControlId);
            let sKey = aFilterItems[i].getName();
            let oFilter = fnGetValuesFromControl(oControl, sKey);

            if (oFilter) {
              // if filter is source name get the selected key
              if (sKey === "SourceName") {
                _oViewModel.setProperty("/sourceName", oFilter.oValue1);
              }

              aFilters.push(oFilter);
            }
          }
        }

        return aFilters;
      },
    });
  }
);
