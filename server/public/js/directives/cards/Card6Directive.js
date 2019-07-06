angular.module('Card6Directive', []).directive('card6', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/statistics/directives/card6.html',
        link: function ($scope, $element, $attrs) {
            $scope.title = gettextCatalog.getString(" (Gender)");
            $scope.labels = [gettextCatalog.getString('Female'), gettextCatalog.getString('Male')];
            $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                //var Chart = $injector.get('Chart');
                $scope.colors = ["#2B98F0", "#1EB8D2"];
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
                var Chart = $injector.get('Chart');
                function build() {
                    $scope.loadingChart = true;
                    Chart.build({
                        name : 'nonFonctionnaire'
                    }).then(function (response) {
                        $scope.loadingChart = false;
                        $scope.data = [
                            Math.round((response.data.totalWomen * 100) / (response.data.totalMen + response.data.totalWomen)),
                            Math.round((response.data.totalMen * 100) / (response.data.totalMen + response.data.totalWomen))
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
                build();
            });
        }
    }
});