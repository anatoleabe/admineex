angular.module('Chart1Directive', []).directive('chart1', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/dashboard/directives/chart1.html',
        link: function ($scope, $element, $attrs) {
            $scope.title = gettextCatalog.getString(" (Gender)");
            $scope.labels = [gettextCatalog.getString('Women'), gettextCatalog.getString('Man')];
            $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                var Chart = $injector.get('Chart');
                $scope.colors = ["#2B98F0", "#ff9000"];
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
                        name : 'chart1'
                    }).then(function (response) {
                        $scope.loadingChart = false;
                        $scope.data = [
                            response.data.totalWomen,
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
