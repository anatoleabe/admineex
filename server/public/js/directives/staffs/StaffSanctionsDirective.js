angular.module('StaffSanctionsDirective', []).directive('sanctions', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            status: '='
        },
        replace: true,
        templateUrl: 'templates/staffs/directives/sanctions.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $ocLazyLoad.load('js/services/SanctionService.js').then(function () {
                var Sanction = $injector.get('Sanction');
                $scope.loading = true;
                $scope.loadingChart = false;
                $scope.nbTasks = 38;
                $scope.tasks1 = 0;

                function load() {
                    var params = {
                        personnelId: $rootScope.selectedPersonnelId,
                    };
                    Sanction.list({filters: JSON.stringify(params)}).then(function (response) {
                        var data = response.data;

                        $scope.sanctions = data.filter(function (el) {
                            return el.type !== "3";
                        });

                        $scope.awards = data.filter(function (el) {
                            return el.type === "3";
                        });

                        $scope.loadingChart = false;
                    }).catch(function (response) {
                        if (response.xhrStatus !== "abort") {
                            console.error(response);
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                priority: 2
                            });
                        }
                        $scope.loadingChart = false;
                    });
                }
                $scope.loadingChart = true;
                load();
                //Update the user sanctions after the update
                $scope.$on('sanctionupdated', function(event, mass) {
                    load();
                });

                var watch = {};
                watch.range = $rootScope.$watch('range', function (newValue, oldValue) {
                    if (newValue.from.value.getTime() !== oldValue.from.value.getTime() || newValue.to.value.getTime() !== oldValue.to.value.getTime()) {
                        $scope.loadingChart = true;
                        build();
                    }
                }, true);
                $scope.$on('$destroy', function () {// in case of directive destroy, we destroy the watch
                    watch.range();
                });
            });
        }
    };
});
