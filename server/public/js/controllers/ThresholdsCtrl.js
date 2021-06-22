angular.module('ThresholdsCtrl', []).controller('ThresholdsController', ['$scope', 'gettextCatalog', '$ocLazyLoad', '$injector', '$rootScope', '$mdDialog', '$transitions', function ($scope, gettextCatalog, $ocLazyLoad, $injector, $rootScope, $mdDialog, $transitions) {
        $ocLazyLoad.load('js/services/ThresholdService.js').then(function () {
            var Threshold = $injector.get('Threshold');
            var thresholds = [{
                    identifier: '0',
                    values: ['5'],
                    state: '1',
                    title: gettextCatalog.getString('Lower than'),
                    placeholder: ''
                }, {
                    identifier: '1',
                    values: ['60', '55'], //Civil cervant
                    state: '1',
                    title: gettextCatalog.getString('Retirement age'),
                    placeholder: gettextCatalog.getString('years'),
                }, {
                    identifier: '2',
                    values: ['60', '55'], //Contractual
                    state: '1',
                    title: gettextCatalog.getString('Retirement age'),
                    placeholder: gettextCatalog.getString('years'),
                }];
            $scope.thresholds = JSON.parse(JSON.stringify(thresholds));
            var saved = [];

            Threshold.list({}).then(function (response) {
                var data = response.data;
                $rootScope.kernel.loading = 100;
                $scope.thresholds[0].placeholder = data.currency;
                for (i = 0; i < data.thresholds.length; i++) {
                    for (j = 0; j < $scope.thresholds.length; j++) {
                        if (data.thresholds[i].identifier == $scope.thresholds[j].identifier) {
                            $scope.thresholds[j].values = data.thresholds[i].values;
                            $scope.thresholds[j].state = data.thresholds[i].state;
                        }
                    }
                }
                saved = JSON.parse(JSON.stringify($scope.thresholds));
                $scope.admin = data.access;
            }).catch(function (response) {
                console.error(response);
            });


            function prepareForServer() {
                var temp = [];
                for (i = 0; i < $scope.thresholds.length; i++) {
                    var val = [];

                    if ($scope.thresholds[i].values.length === 2) {
                        val[0] = String($scope.thresholds[i].values[0]);
                        val[1] = String($scope.thresholds[i].values[1]);
                    } else {
                        val[0] = String($scope.thresholds[i].values[0]);
                    }
                    temp.push({
                        identifier: $scope.thresholds[i].identifier,
                        values: val,
                        state: $scope.thresholds[i].state
                    });
                }
                return temp;
            }

            function resetValues() {
                $scope.thresholds = [];
                $scope.thresholds = JSON.parse(JSON.stringify(thresholds));
                ;
            }

            $scope.save = function () {
                Threshold.save({thresholds: prepareForServer()}).then(function (response) {
                    saved = [];
                    $rootScope.kernel.alerts.push({
                        type: 3,
                        msg: gettextCatalog.getString('Thresholds parameters has been saved'),
                        priority: 4
                    });
                }).catch(function (response) {
                    console.error(response);
                });
            }

            $scope.showConfirm = function () {
                var confirm = $mdDialog.confirm()
                        .title(gettextCatalog.getString("Reset to default"))
                        .textContent(gettextCatalog.getString("Are you sure you want to reset to default values") + gettextCatalog.getString("?"))
                        .ok(gettextCatalog.getString("Reset"))
                        .cancel(gettextCatalog.getString("Cancel"));

                $mdDialog.show(confirm).then(function () {
                    // Reset
                    resetValues();
                }, function () {
                    // Cancel
                });
            }

            $scope.showPrompt = function (index, index1) {
                var confirm = $mdDialog.prompt()
                        .title($scope.thresholds[index].title + gettextCatalog.getString('?'))
                        .placeholder($scope.thresholds[index].placeholder)
                        .ariaLabel($scope.thresholds[index].placeholder)
                        .initialValue($scope.thresholds[index].values[(index1) ? 1 : 0])
                        .ok(gettextCatalog.getString("OK"))
                        .cancel(gettextCatalog.getString("Cancel"));

                $mdDialog.show(confirm).then(function (result) {
                    if (result !== "" && !isNaN(result) && result > -1) {
                        if (index1) {
                            $scope.thresholds[index].values[1] = result;
                        } else {
                            $scope.thresholds[index].values[0] = result;
                        }
                    }
                }, function () {

                });
            };

            $scope.showSpecialPrompt = function (index) {
                $mdDialog.show({
                    controller: ['$scope', '$mdDialog', 'threshold', function ($scope, $mdDialog, threshold) {
                            $scope.threshold = threshold;
                            $scope.close = function (threshold) {
                                $mdDialog.hide(threshold);
                            }
                        }],
                    template:
                            '<md-dialog aria-label="' + $scope.thresholds[index].title + '">' +
                            '<form>' +
                            '   <md-dialog-content class="md-dialog-content">' +
                            '       <h2 class="md-title">' + $scope.thresholds[index].title + gettextCatalog.getString('?') +
                            '       </h2>' +
                            '       <md-input-container>' +
                            '           <label>' + $scope.thresholds[index].placeholder + '</label>' +
                            '           <input ng-model="threshold.values[0]">' +
                            '       </md-input-container>' +
                            '       <md-input-container>' +
                            '           <label>' + $scope.thresholds[index].placeholder + '</label>' +
                            '           <input ng-model="threshold.values[1]">' +
                            '       </md-input-container>' +
                            '   </md-dialog-content>' +
                            '   <md-dialog-actions>' +
                            '       <md-button ng-click="close()" class="md-primary">' +
                            gettextCatalog.getString('Cancel') +
                            '       </md-button>' +
                            '       <md-button ng-click="close(threshold)" class="md-primary">' +
                            gettextCatalog.getString('OK') +
                            '       </md-button>' +
                            '   </md-dialog-actions>' +
                            '<form>' +
                            '</md-dialog>',
                    locals: {
                        threshold: JSON.parse(JSON.stringify($scope.thresholds[index]))
                    },
                    parent: angular.element(document.body),
                    clickOutsideToClose: true,
                }).then(function (threshold) {
                    if (threshold && (threshold.values[0] !== "" && !isNaN(threshold.values[0]) && threshold.values[0] > -1)) {
                        $scope.thresholds[index].values[0] = threshold.values[0];
                    }
                    if (threshold && (threshold.values[1] !== "" && !isNaN(threshold.values[1]) && threshold.values[1] > -1)) {
                        $scope.thresholds[index].values[1] = threshold.values[1];
                    }
                }, function () {

                });
            };

            $scope.showSpecialPrompt11 = function (index) {
                $mdDialog.show({
                    controller: ['$scope', '$mdDialog', 'threshold', function ($scope, $mdDialog, threshold) {
                            $scope.threshold = threshold;
                            $scope.close = function (threshold) {
                                $mdDialog.hide(threshold);
                            }
                        }],
                    template:
                            '<md-dialog aria-label="' + $scope.thresholds[index].title + '">' +
                            '<form>' +
                            ' <md-dialog-content>' +
                            ' <div class="md-dialog-content"> ' +
                            '       <h2 class="md-title">' + $scope.thresholds[index].title + gettextCatalog.getString('?') +
                            '       </h2>' +
                            '<div>' +
                            '       <md-input-container  class="md-block" flex-gt-sm><label translate>Duration</label>' +
                            '       <md-select ng-model="threshold.values[0]">' +
                            '         <md-option ng-value="1">1 <span translate>week</span></md-option>' +
                            '         <md-option ng-value="2">2 <span translate>weeks</span></md-option>' +
                            '         <md-option ng-value="4">1 <span translate>month</span></md-option>' +
                            '         <md-option ng-value="12">3 <span translate>months</span></md-option>' +
                            '       </md-select>' +
                            '       </md-input-container>' +
                            ' <md-input-container class="md-block" flex-gt-sm>' +
                            '       <label translate>Alert stock</label>' +
                            '       <input ng-model="threshold.values[1]" required>' +
                            ' </md-input-container>' +
                            ' </div>' +
                            '</div> ' +
                            '</md-dialog-content> ' +
                            '   <md-dialog-actions  layout="row">' +
                            '       <md-button ng-click="close()" class="md-primary">' +
                            gettextCatalog.getString('Cancel') +
                            '       </md-button>' +
                            '       <md-button ng-click="close(threshold)" class="md-primary">' +
                            gettextCatalog.getString('OK') +
                            '       </md-button>' +
                            '   </md-dialog-actions>' +
                            '<form>' +
                            '</md-dialog>',
                    locals: {
                        threshold: JSON.parse(JSON.stringify($scope.thresholds[index]))
                    },
                    parent: angular.element(document.body),
                    clickOutsideToClose: true,
                }).then(function (threshold) {
                    if (threshold && (threshold.values[0] !== "" && !isNaN(threshold.values[0]) && threshold.values[0] > -1)) {
                        $scope.thresholds[index].values[0] = threshold.values[0];
                    }
                    if (threshold && (threshold.values[1] !== "" && !isNaN(threshold.values[1]) && threshold.values[1] > -1)) {
                        $scope.thresholds[index].values[1] = threshold.values[1];
                    }
                }, function () {

                });
            };

            $transitions.onExit({}, function (trans) {
                if (saved.length > 0 && !angular.equals(saved, $scope.thresholds)) {
                    saved = [];
                    var confirm = $mdDialog.confirm()
                            .title(gettextCatalog.getString("Warning"))
                            .textContent(gettextCatalog.getString("Would you like to save the new configuration") + gettextCatalog.getString("?"))
                            .ok(gettextCatalog.getString("Save"))
                            .cancel(gettextCatalog.getString("Cancel"));

                    $mdDialog.show(confirm).then(function () {
                        // Save
                        $scope.save();
                    }, function () {
                        // Cancel
                    });
                }
            });
        });
    }]);