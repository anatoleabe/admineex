angular.module('PersonnelChartDirective', []).directive('personnelChart', function($ocLazyLoad, $injector) {
    return {
        restrict: 'E',
        scope: {
            chartType: '@',
            chartId: '@',
            data: '=',
            options: '=',
            loading: '='
        },
        templateUrl: 'templates/dashboard/widgets/personnel-chart.html',
        link: function(scope, element, attrs) {
            if (!scope.chartId) {
                scope.chartId = 'chart-' + Math.random().toString(36).substr(2, 9);
            }
            
            scope.$watch('data', function(newData) {
                if (newData && !scope.loading) {
                    scope.renderChart();
                }
            });
            
            scope.renderChart = function() {
                var ctx = document.getElementById(scope.chartId);
                if (ctx && scope.data) {
                    var chartOptions = scope.options || {
                        responsive: true,
                        maintainAspectRatio: false,
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                fontColor: '#666'
                            }
                        },
                        tooltips: {
                            enabled: true,
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(tooltipItem, data) {
                                    var label = data.labels[tooltipItem.index] || '';
                                    var value = data.datasets[0].data[tooltipItem.index];
                                    return label + ': ' + value;
                                }
                            }
                        }
                    };
                    
                    if (scope.chart) {
                        scope.chart.destroy();
                    }
                    
                    scope.chart = new Chart(ctx, {
                        type: scope.chartType || 'doughnut',
                        data: scope.data,
                        options: chartOptions
                    });
                }
            };
        }
    };
});
