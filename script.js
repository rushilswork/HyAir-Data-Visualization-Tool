document.addEventListener('DOMContentLoaded', function () {
  var map = L.map('map').setView([17.385044, 78.486671], 12)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  }).addTo(map)

  // Add an event listener for the file input change event

  loadAndProcessData('dataset.txt')

  // Add an event listener for the file input change event
  document.getElementById('myfile').addEventListener('change', handleFileSelect)

  function handleFileSelect(event) {
    var file = event.target.files[0]

    if (file) {
      var reader = new FileReader()

      reader.onload = function (e) {
        var data = e.target.result
        // Clear existing markers and reload the map with the new data
        map.eachLayer(function (layer) {
          if (layer instanceof L.Marker) {
            map.removeLayer(layer)
          }
        })
        processData(data)

        // Display a success message in a popup
        showAlert('File Upload Successful', 'success')
      }

      reader.readAsText(file)
    }
  }

  function showAlert(message, type) {
    var alertContainer = document.getElementById('alert-container')
    var alert = document.createElement('div')
    alert.className = 'alert ' + type
    alert.innerHTML = message
    alertContainer.appendChild(alert)

    // Remove the alert after 3 seconds (adjust the timeout as needed)
    setTimeout(function () {
      alert.remove()
    }, 3000)
  }

  function loadAndProcessData(file) {
    fetch(file)
      .then((response) => response.text())
      .then((data) => {
        processData(data)
      })
      .catch((error) => {
        console.log('Error fetching data:', error)
      })
  }

  function processData(data) {
    var dataset = data.trim().split('\n')

    var regions = []

    dataset.forEach(function (coord) {
      var parts = coord.split(',')
      var latitude = parseFloat(parts[0])
      var longitude = parseFloat(parts[1])
      var airIndex = parseFloat(parts[2])

      var textBoxClass
      if (airIndex >= 0 && airIndex <= 80) {
        textBoxClass = 'custom-text-box'
      } else if (airIndex > 80 && airIndex <= 93) {
        textBoxClass = 'custom-yellow-text-box'
      } else {
        textBoxClass = 'custom-red-text-box'
      }

      var textBox = L.divIcon({
        className: textBoxClass,
        html: '<div class="air-index-text">' + airIndex + '</div>',
        iconSize: [60, 60],
      })

      var marker = L.marker([latitude, longitude], { icon: textBox }).addTo(map)

      var mylocation = ''

      var geocodingUrl =
        'https://maps.googleapis.com/maps/api/geocode/json?latlng=' +
        latitude +
        ',' +
        longitude +
        '&key=REMOVED_API_KEY'

      fetch(geocodingUrl)
        .then((response) => response.json())
        .then((data) => {
          if (data.status === 'OK') {
            var results = data.results
            if (results.length > 0) {
              var locationName = results[0].formatted_address
              var addressParts = locationName.split(',')
              var size = addressParts.length
              var secondToken = addressParts[size - 4].trim()
              marker.bindPopup(
                'Location: ' + secondToken + '<br>Air Index: ' + airIndex,
              )
              mylocation = secondToken
            }
          }
        })
        .catch((error) => {})

      marker.on('click', function () {
        map.setView(marker.getLatLng(), 12)
        var pollutantData = {
          labels: [
            'PM2.5 (µg/m³)',
            'PM10 (µg/m³)',
            'SO2 (µg/m³)',
            'O3 (µg/m³)',
            'CO (µg/m³)',
            'NO2 (µg/m³)',
          ],
          datasets: [
            {
              data: [
                parseFloat(parts[3]),
                parseFloat(parts[4]),
                parseFloat(parts[5]),
                parseFloat(parts[6]),
                parseFloat(parts[7]),
                parseFloat(parts[8]),
                parseFloat(parts[9]),
              ],
              backgroundColor: [
                'rgba(255, 0, 0, 0.8)',
                'rgba(54, 0, 255, 0.8)',
                'rgba(255, 0, 255, 0.8)',
                'rgba(99, 255, 0, 0.8)',
                'rgba(10, 100, 100, 0.8)',
                'rgba(255, 255, 255, 0.8)',
                'rgba(255, 0, 0, 0.5)',
              ],
              borderColor: [
                'rgba(255, 0, 0, 0.8)',
                'rgba(54, 0, 255, 0.8)',
                'rgba(255, 0, 255, 0.8)',
                'rgba(99, 255, 0, 0.8)',
                'rgba(10, 100, 100, 0.8)',
                'rgba(255, 255, 255, 0.8)',
                'rgba(255, 0, 0, 0.5)',
              ],
              borderWidth: 0,
            },
          ],
        }
        var chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          legend: {
            position: 'right',
          },
        }

        var chartContainer = document.getElementById('pollutant-chart')

        if (chartContainer) {
          chartContainer.remove()
        }

        var newChartContainer = document.createElement('canvas')
        newChartContainer.id = 'pollutant-chart'
        newChartContainer.width = 200
        newChartContainer.height = 200
        newChartContainer.style.width = '400px'
        newChartContainer.style.height = '400px'
        document
          .getElementById('popout-container')
          .appendChild(newChartContainer)

        var chartContext = newChartContainer.getContext('2d')
        var pollutantChart = new Chart(chartContext, {
          type: 'pie',
          data: pollutantData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            legend: {
              position: 'right',
            },
            plugins: {
              chartjsPluginChartjs3d: {
                enabled: true,
                alphaAngle: 60,
                betaAngle: 30,
              },
            },
          },
        })

        document.getElementById('popout-container').style.display = 'block'
        if (mylocation == '') {
          document.querySelector('#region-name').innerHTML = 'Region'
        } else {
          document.querySelector('#region-name').innerHTML = mylocation
        }
        document.querySelector('#region-name').style.color = '#00FF00'
        var myloc = ''
        if (mylocation == '') {
          myloc = 'Region'
        } else {
          myloc = mylocation
        }
        var pollutantLevels = `
              
              <div class="chart-container" style="margin-left: 50px">
              <div class="chart-item">
              <p>PM2.5 Levels: ${calculateFirstElement(parts[3])}</p>
              <svg class="circle-chart" id="pm25-chart">
                <circle class="circle-chart-background" r="30" cx="50" cy="50"></circle>
                <circle class="circle-chart-circle" r="30" cx="50" cy="50"></circle>
              </svg>
            </div>
            <div class="chart-item">
              <p>PM10 Levels: ${calculateFirstElement(parts[4])}</p>
              <svg class="circle-chart" id="pm10-chart">
                <circle class="circle-chart-background" r="30" cx="50" cy="50"></circle>
                <circle class="circle-chart-circle" r="30" cx="50" cy="50"></circle>
              </svg>
            </div>
            <div class="chart-item">
              <p>SO2 Levels: ${calculateFirstElement(parts[5])}</p>
              <svg class="circle-chart" id="so2-chart">
                <circle class="circle-chart-background" r="30" cx="50" cy="50"></circle>
                <circle class="circle-chart-circle" r="30" cx="50" cy="50"></circle>
              </svg>
            </div>
            <div class="chart-item">
              <p>O3 Levels: ${calculateFirstElement(parts[6])}</p>
              <svg class="circle-chart" id="o3-chart">
                <circle class="circle-chart-background" r="30" cx="50" cy="50"></circle>
                <circle class="circle-chart-circle" r="30" cx="50" cy="50"></circle>
              </svg>
            </div>
            <div class="chart-item">
              <p>CO Levels: ${calculateFirstElement(parts[7])}</p>
              <svg class="circle-chart" id="co-chart">
                <circle class="circle-chart-background" r="30" cx="50" cy="50"></circle>
                <circle class="circle-chart-circle" r="30" cx="50" cy="50"></circle>
              </svg>
            </div>
            <div class="chart-item">
              <p>NO2 Levels: ${calculateFirstElement(parts[8])}</p>
              <svg class="circle-chart" id="no2-chart">
                <circle class="circle-chart-background" r="30" cx="50" cy="50"></circle>
                <circle class="circle-chart-circle" r="30" cx="50" cy="50"></circle>
              </svg>
            </div>
          </div>
        `

        document.getElementById('pollutant-levels2').innerHTML = pollutantLevels
        document.getElementById('popout-container2').style.display = 'block'

        animateCircularGraph('pm25-chart', calculateFirstElement(parts[3]))
        animateCircularGraph('pm10-chart', calculateFirstElement(parts[4]))
        animateCircularGraph('so2-chart', calculateFirstElement(parts[5]))
        animateCircularGraph('o3-chart', calculateFirstElement(parts[6]))
        animateCircularGraph('co-chart', calculateFirstElement(parts[7]))
        animateCircularGraph('no2-chart', calculateFirstElement(parts[8]))
      })

      regions.push({
        marker: marker,
        airIndex: airIndex,
        no2Levels: [parseFloat(parts[8])],
      })
    })

    regions.forEach(function (region) {
      if (region.airIndex.length > 0) {
        var number = calculateAverage(region.airIndex)
        var textBoxClass

        if (number >= 0 && number <= 80) {
          textBoxClass = 'custom-text-box'
        } else if (number >= 80 && number <= 93) {
          textBoxClass = 'custom-yellow-text-box'
        } else {
          textBoxClass = 'custom-red-text-box'
        }

        var textBox = L.divIcon({
          className: textBoxClass,
          html: '<div class="air-index-text">' + number + '</div>',
          iconSize: [60, 60],
        })

        region.marker.setIcon(textBox)
      }
    })

    // Add event listeners for location links here

    var hyderabadLink = document.getElementById('hyderabad-link')
    hyderabadLink.addEventListener('click', function () {
      map.setView([17.385044, 78.486671], 11) // Set the view to Hyderabad when clicked
    })

    var mumbaiLink = document.getElementById('mumbai-link')
    mumbaiLink.addEventListener('click', function () {
      map.setView([19.076, 72.8777], 11) // Set the view to Mumbai when clicked
    })

    var ahmedabadLink = document.getElementById('ahmedabad-link')
    ahmedabadLink.addEventListener('click', function () {
      map.setView([23.0225, 72.5714], 11) // Set the view to Ahmedabad when clicked
    })

    var delhiLink = document.getElementById('delhi-link')
    delhiLink.addEventListener('click', function () {
      map.setView([28.6139, 77.209], 10) // Set the view to Delhi when clicked
    })
  }

  function animateCircularGraph(chartId, level) {
    var chart = document.getElementById(chartId)
    var radius = 30 // Adjust the radius size as desired
    var circumference = 2 * Math.PI * radius
    var percentage = (level / 100) * circumference

    chart.innerHTML = `
            <svg class="circle-chart" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle class="circle-chart__background" stroke="#eee" stroke-width="8" fill="none" cx="50" cy="50" r="${radius}"></circle>
              <circle class="circle-chart__circle" stroke-width="8" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" transform="rotate(-90 50 50)" fill="none" cx="50" cy="50" r="${radius}" style="stroke: ${getColor(
      level,
      chartId,
    )};"></circle>
              <text class="circle-chart__percentage" x="50" y="50" alignment-baseline="central" text-anchor="middle" font-size="20px" font-weight="bold">${level}</text>
            </svg>
          `
    var circle = chart.querySelector('.circle-chart__circle')

    anime({
      targets: circle,
      strokeDashoffset: {
        value: circumference - percentage,
        duration: 2000,
        easing: 'easeInOutCirc',
      },
    })
  }
  function calculateAverage(arr) {
    var sum = arr.reduce(function (a, b) {
      return a + b
    }, 0)
    return (sum / arr.length).toFixed(2)
  }
  function getColor(level, pollutant) {
    switch (pollutant) {
      case 'pm25-chart':
        if (level <= 12) return 'green'
        if (level <= 35.4) return 'yellow'
        return 'red'
      case 'pm10-chart':
        if (level <= 54) return 'green'
        if (level <= 154) return 'yellow'
        return 'red'
      case 'so2-chart':
        if (level <= 35) return 'green'
        if (level <= 75) return 'yellow'
        return 'red'
      case 'o3-chart':
        if (level <= 54) return 'green'
        if (level <= 70) return 'yellow'
        return 'red'
      case 'co-chart':
        if (level <= 4.4) return 'green'
        if (level <= 9.4) return 'yellow'
        return 'red'
      case 'no2-chart':
        if (level <= 53) return 'green'
        if (level <= 100) return 'yellow'
        return 'red'
      default:
        return 'black'
    }
  }
  function calculateFirstElement(data) {
    return parseFloat(data.split(',')[0])
  }
  // Define a variable to store the current dataset
  // Define a variable to store the current dataset
  // Define a variable to store the current dataset
  let currentDataset = null

  // Add an event listener to the file input element
  document
    .getElementById('myfile')
    .addEventListener('change', newhandleFileSelect)

  // Initial data fetching on window load
  window.onload = function () {
    // Use the original dataset on window load
    if (currentDataset) {
      processDataFunction(currentDataset)
    } else {
      fetchOriginalDataset()
    }
  }

  // Function to fetch the original dataset.txt
  function fetchOriginalDataset() {
    fetch('dataset.txt')
      .then((response) => response.text())
      .then((data) => {
        // Update the current dataset
        currentDataset = data
        processDataFunction(data)
      })
      .catch((error) => {
        console.error('Error fetching the original dataset:', error)
      })
  }

  // Function to handle file selection
  function newhandleFileSelect(event) {
    const fileInput = event.target

    // Check if a file is selected
    if (fileInput.files.length > 0) {
      const selectedFile = fileInput.files[0]
      const reader = new FileReader()

      // Read the contents of the selected file
      reader.onload = function (e) {
        const fileData = e.target.result

        // Update the current dataset
        currentDataset = fileData

        // Process the new dataset
        processDataFunction(fileData)
      }

      // Read file as text
      reader.readAsText(selectedFile)
    } else {
      // If no file is selected, fetch the original dataset
      fetchOriginalDataset()
    }
  }
  function destroyChart(str) {
    const existingChart = Chart.getChart(str)
    if (existingChart) {
      existingChart.destroy()
    }
  }
  // Modified processData function with a different name
  function processDataFunction(data) {
    destroyChart('data-body')
    const rows = data
      .trim()
      .split('\n')
      .map((row) => row.split(','))

    const cityMap = new Map() // Map to store city data
    rows.forEach((row) => {
      const cityName = row[row.length - 1].trim()
      const aqi = parseFloat(row[4])

      if (!cityMap.has(cityName)) {
        cityMap.set(cityName, [aqi, 1]) // [Total AQI, Count]
      } else {
        const [totalAQI, count] = cityMap.get(cityName)
        cityMap.set(cityName, [totalAQI + aqi, count + 1])
      }
    })

    // Calculate average AQI for each city
    const cityAverages = []
    cityMap.forEach((value, key) => {
      const [totalAQI, count] = value
      const averageAQI = totalAQI / count
      cityAverages.push({ cityName: key, averageAQI })
    })

    // Sort city averages by AQI in ascending order
    cityAverages.sort((a, b) => a.averageAQI - b.averageAQI)

    // Display data in the table
    const tableBody = document.getElementById('data-body')
    tableBody.innerHTML = '' // Clear the table before populating new data

    // Display data in the bar graph
    const labels = cityAverages.map((city) => city.cityName)
    const dataValues = cityAverages.map((city) => city.averageAQI.toFixed(2))
    const backgroundColors = cityAverages.map((city) =>
      getColorForAQI(city.averageAQI),
    )

    const largerChartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      legend: {
        display: true,
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: false, // Change 'yes' to 'true'
        },
      },
    }

    // Generate random colors for each bar
    const randomColors = Array.from({ length: dataValues.length }, () =>
      getRandomColor(),
    )

    // Create a larger bar chart inside the container div with random colors
    const largerCtx = document.getElementById('bar-chart').getContext('2d')
    destroyChart('bar-chart')
    const largerBarChart = new Chart(largerCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Average AQI',
            data: dataValues,
            backgroundColor: randomColors,
          },
        ],
      },
      options: largerChartOptions, // Apply the modified options
    })

    // Populate data in the table
    cityAverages.forEach((city) => {
      const row = document.createElement('tr')
      const cityNameCell = document.createElement('td')
      const aqiCell = document.createElement('td')

      cityNameCell.textContent = city.cityName
      aqiCell.textContent = city.averageAQI.toFixed(2)

      // Set background color based on AQI value
      const color = getColorForAQI(city.averageAQI)
      aqiCell.style.backgroundColor = color

      row.appendChild(cityNameCell)
      row.appendChild(aqiCell)
      tableBody.appendChild(row)
    })
  }

  // Modified window.onload event to use the currentDataset
  window.onload = function () {
    // Use the original dataset on window load
    if (currentDataset) {
      processDataFunction(currentDataset)
    } else {
      fetchOriginalDataset()
    }
  }

  // Function to generate a random color
  function getRandomColor() {
    const letters = '0123456789ABCDEF'
    let color = '#'
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)]
    }
    return color
  }

  // Function to get color based on AQI value
  function getColorForAQI(aqi) {
    if (aqi > 100) {
      return 'red'
    } else if (aqi >= 70 && aqi <= 100) {
      return 'yellow'
    } else {
      return '#00ff00c2'
    }
  }

  // Event listener for the "My Location" button
  // ... (previous code)

  // Event listener for the "My Location" button
  document
    .getElementById('myLocationButton')
    .addEventListener('click', function () {
      // Check if the Geolocation API is available
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          function (position) {
            // Get the latitude and longitude from the Geolocation API
            var userLat = position.coords.latitude
            var userLng = position.coords.longitude

            // Set the map view to the user's location
            map.setView([userLat, userLng], 12)

            // Display a success message in a popup
            showAlert('Location Fetched Successfully', 'success')
          },
          function (error) {
            console.error('Error:', error)

            // Display an error message in a popup
            showAlert('Error getting user location', 'error')
          },
        )
      } else {
        console.error('Geolocation is not supported by your browser')

        // Display an error message in a popup
        showAlert('Geolocation is not supported by your browser', 'error')
      }
    })

  // Function to fetch the user's IP address
  function fetchUserIpAddress() {
    fetch('https://ipinfo.io/json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok')
        }
        return response.json()
      })
      .then((data) => {
        var ipAddress = data.ip
        showAlert('Your IP Address: ' + ipAddress, 'info')
      })
      .catch((error) => {
        console.error('Error fetching user IP address:', error)
        showAlert('Error fetching user IP address', 'error')
      })
  }

  // Modify the showAlert function to update the user's IP address
  function showAlert(message, type) {
    var alertContainer = document.getElementById('alert-container')
    var alert = document.createElement('div')
    alert.className = 'alert ' + type
    alert.innerHTML = message
    alertContainer.appendChild(alert)

    // Remove the alert after 3 seconds (adjust the timeout as needed)
    setTimeout(function () {
      alert.remove()
      // If it's a success alert and the message contains "Location Fetched Successfully"
      if (
        type === 'success' &&
        message.includes('Location Fetched Successfully')
      ) {
        // Fetch the user's IP address after the location fetch alert
        fetchUserIpAddress()
      }
    }, 3000)
  }
  function updateLiveTime() {
    var currentTime = new Date();
    var hours = currentTime.getHours();
    var minutes = currentTime.getMinutes();
    var seconds = currentTime.getSeconds();

    // Format the time in 24-hour format
    var formattedTime =
      leadingZero(hours) + ':' + leadingZero(minutes) + ':' + leadingZero(seconds);

    // Update the HTML element with the live time
    document.getElementById('live-time').textContent = 'Live Time: ' +  formattedTime;
  }

  // Function to add leading zero to single-digit numbers
  function leadingZero(number) {
    return number < 10 ? '0' + number : number;
  }

  // Update the live time every second
  setInterval(updateLiveTime, 1000);
})
