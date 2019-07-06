angular.module('Chart4Directive', []).directive('chart4', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/dashboard/directives/chart4.html',
        link: function ($scope, $element, $attrs) {
            $scope.title = gettextCatalog.getString("The corp of treasure officials (Category)");
            $scope.labels = [gettextCatalog.getString('Category A'), gettextCatalog.getString('Category B'), gettextCatalog.getString('Category C'), gettextCatalog.getString('Category D')];
            $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                //var Chart = $injector.get('Chart');
                //$scope.colors = ["#2B98F0", "#1EB8D2"];
                $scope.options = {
                    tooltips: {
                        callbacks: {
                            label: function (tooltipItem, data) {
                                var datasetLabel = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                                var label = data.labels[tooltipItem.index];
                                return label + gettextCatalog.getString(':') + ' ' + datasetLabel;
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        reverse: true
                    }
                }
                function build() {
                    $scope.loadingChart = true;
//                    Chart.build({
//                        name : 'chart1',
//                    }).then(function(response){
//                        var data = response.data;
//                        $scope.loadingChart = false;
//                        //$scope.data = data.data;
//                        $scope.data = [300, 500];
//                    }).catch(function(response) {
//                        $rootScope.kernel.alerts.push({
//                            type: 1,
//                            msg: gettextCatalog.getString('An error occurred, please try again later'),
//                            priority: 2
//                        });
//                    });
                    $scope.loadingChart = false;
                    //$scope.data = data.data;
                    $scope.data = [0, 0, 0, 0];
                }
                build();
            });
        }
    }
});