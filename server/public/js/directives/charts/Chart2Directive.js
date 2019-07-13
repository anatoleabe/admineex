angular.module('Chart2Directive', []).directive('chart2', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/dashboard/directives/chart2.html',
        link: function ($scope, $element, $attrs) {
            $scope.title = gettextCatalog.getString("The corp of treasure officials (Gender)");
            $scope.labels = [gettextCatalog.getString('Female'), gettextCatalog.getString('Male')];
            $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                var Chart = $injector.get('Chart');
                $scope.colors = ["#d30c0c", "#c4901f"];
                $scope.options = {
                    tooltips: {
                        callbacks: {
                            label: function (tooltipItem, data) {
                                var datasetLabel = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                                var total = data.datasets[tooltipItem.datasetIndex].data[0] + data.datasets[tooltipItem.datasetIndex].data[1];
                                var percent = Math.round((datasetLabel * 100) / total);
                                var label = data.labels[tooltipItem.index];
                                return label + gettextCatalog.getString(':') + ' ' + percent + '%';
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
                    Chart.build({
                        name : 'chart2'
                    }).then(function (response) {
                        $scope.loadingChart = false;
                        $scope.data = [
                            response.data.totalWomen ,
                            response.data.totalMen
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