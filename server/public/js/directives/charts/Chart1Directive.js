angular.module('Chart1Directive', []).directive('chart1', ['gettextCatalog', '$ocLazyLoad', '$injector', '$rootScope', function(gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/dashboard/directives/chart1.html',
        link: function($scope, $element, $attrs) {
            $scope.loadingChart = true;
            $scope.title = gettextCatalog.getString("Forecast income by probability") + " - " + gettextCatalog.getString("12 months");
            $scope.series = [gettextCatalog.getString('Probability of Success') + gettextCatalog.getString(':') + " < 50%", gettextCatalog.getString('Probability of Success') + gettextCatalog.getString(':') + " > 50%"];
            $scope.colors = [{
                backgroundColor: 'rgba(229, 57, 53, 1)',
                pointBackgroundColor: 'rgba(229, 57, 53, 1)',
                pointHoverBackgroundColor: 'rgba(229, 57, 53, 1)',
                borderColor: 'rgba(229, 57, 53, 1)',
                pointBorderColor: '#fff',
                pointHoverBorderColor: 'rgba(229, 57, 53, 1)'
            },{
                backgroundColor: 'rgba(156, 204, 101, 1)',
                pointBackgroundColor: 'rgba(156, 204, 101, 1)',
                pointHoverBackgroundColor: 'rgba(156, 204, 101, 1)',
                borderColor: 'rgba(156, 204, 101, 1)',
                pointBorderColor: '#fff',
                pointHoverBorderColor: 'rgba(156, 204, 101, 1)'
            }];

            $ocLazyLoad.load('js/services/ChartService.js').then(function() {
                var Chart = $injector.get('Chart');
                $scope.options = {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    scales: {
                        xAxes: [{
                            stacked: true,
                            gridLines: {
                                display: false
                            }
                        }],
                        yAxes: [{
                            stacked: true,
                            scaleLabel: {
                                display: true,
                                labelString: gettextCatalog.getString('Forecast income in M€')
                            },
                            gridLines: {
                                display: false
                            }
                        }]
                    }
                };
                function build(){
                    Chart.build({
                        name : 'chart1'
                    }).then(function(response){
                        var data = response.data;
                        $scope.loadingChart = false;
                        $scope.data = data.data;
                        for(i=0;i<data.labels.length;i++){
                            data.labels[i] = gettextCatalog.getString(data.labels[i]);
                            data.labels[i] = data.labels[i].substr(0, 3) + ".";
                        }
                        $scope.labels = data.labels;
                    }).catch(function(response) {
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                    });
                }
                build();
            }).catch(function(response) {
                console.log(response);
            });
        }
    }
}]);