angular.module('Card2Directive', []).directive('card2', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/statistics/directives/card2.html',
        link: function ($scope, $element, $attrs) {
            $scope.loadingChart = true;

            $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                var Chart = $injector.get('Chart');
                function build() {
                    $scope.loadingChart = true;
                    Chart.build({
                        name: 'card2'
                    }).then(function (response) {
                        $scope.loadingChart = false;
                        $scope.data = [
                            response.data.ipt,
                            response.data.it,
                            response.data.cpt,
                            response.data.ct,
                            response.data.cat,
                            response.data.commis
                        ];
                    }).catch(function (response) {
                        console.log(response);
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                    });
                }
                $scope.export = function () {
                    var data = [];
                    data.push({category: gettextCatalog.getString("Inspecteurs Principaux du Trésor"), value1: $scope.data[0]});
                    data.push({category: gettextCatalog.getString("Inspecteurs du Trésor"), value1: $scope.data[1]});
                    data.push({category: gettextCatalog.getString("Contrôleurs Principaux du Trésor"), value1: $scope.data[2]});
                    data.push({category: gettextCatalog.getString("Contrôleurs du Trésor"), value1: $scope.data[3]});
                    data.push({category: gettextCatalog.getString("Contrôleurs Adjoints du Trésor"), value1: $scope.data[4] });
                    data.push({category: gettextCatalog.getString("Commis of  Trésor"), value1: $scope.data[5]});
                    return {
                        title: gettextCatalog.getString("Corps of Treasury"),
                        fields: ["category", "value1"],
                        fieldNames: [gettextCatalog.getString("Category"), gettextCatalog.getString("Effective")],
                        data: data
                    };
                }

                $scope.$root.$watch('selectedStructure', function (newval, oldval) {
                    if (newval) {
                        //console.log("Changement card 2");
                    }
                });
                build();
            });
        }
    };
});
