import random

# Define the region centers for each city
city_centers = {
    'Hyderabad': {'min_lat': 17.2264631476935, 'max_lat': 17.517706116224506, 'min_lon': 78.36734517737335, 'max_lon': 78.57699240697085},
    'Delhi': {'min_lat': 28.412916, 'max_lat': 28.879167, 'min_lon': 76.838607, 'max_lon': 77.349037},
    'Mumbai': {'min_lat': 18.892245, 'max_lat': 19.281266, 'min_lon': 72.769482, 'max_lon': 72.986068},
    'Chennai': {'min_lat': 12.845874, 'max_lat': 13.215072, 'min_lon': 80.191433, 'max_lon': 80.320139},
    'Lucknow': {'min_lat': 26.700203, 'max_lat': 27.179144, 'min_lon': 80.869217, 'max_lon': 81.118580},
    'Patna': {'min_lat': 25.562063, 'max_lat': 25.686684, 'min_lon': 85.051630, 'max_lon': 85.286601},
    'Odisha': {'min_lat': 20.942917, 'max_lat': 21.333129, 'min_lon': 83.478359, 'max_lon': 86.370195},
    'Goa': {'min_lat': 15.204145, 'max_lat': 15.854667, 'min_lon': 73.724609, 'max_lon': 74.252168},
    'Kochi': {'min_lat': 9.919691, 'max_lat': 10.235641, 'min_lon': 76.178481, 'max_lon': 76.366600},
    'Vishakhapatnam': {'min_lat': 17.633109, 'max_lat': 17.764825, 'min_lon': 83.220886, 'max_lon': 83.412381},
    'Ahmedabad': {'min_lat': 22.936699, 'max_lat': 23.152968, 'min_lon': 72.482336, 'max_lon': 72.694614}
}

# Define the number of coordinates to generate per city
num_coordinates = 10

# Generate random coordinates within each city area and assign regions and air index
dataset = []
for city, boundaries in city_centers.items():
    min_lat, max_lat = boundaries['min_lat'], boundaries['max_lat']
    min_lon, max_lon = boundaries['min_lon'], boundaries['max_lon']
    
    for _ in range(num_coordinates):
        latitude = round(random.uniform(min_lat, max_lat), 6)
        longitude = round(random.uniform(min_lon, max_lon), 6)
        air_index = random.randint(55, 120)
        pm25Levels = random.randint(30, 40)
        pm10Levels = random.randint(57, 79)
        so2Levels = random.randint(2, 3)
        o3Levels = random.randint(0, 15)
        coLevels = random.randint(1, 26)
        no2Levels = random.randint(4, 5)

        dataset.append({
            
            'latitude': latitude,
            'longitude': longitude,
            'air_index': air_index,
            'pm25Levels': pm25Levels,
            'pm10Levels': pm10Levels,
            'so2Levels': so2Levels,
            'o3Levels': o3Levels,
            'coLevels': coLevels,
            'no2Levels': no2Levels,
            'city': city
        })

# Save the dataset to a text file
with open('dataset1.txt', 'w') as file:
    for data in dataset:
        file.write(f"{data['latitude']},{data['longitude']},{data['air_index']},{data['pm25Levels']},{data['pm10Levels']},{data['so2Levels']},{data['o3Levels']},{data['coLevels']},{data['no2Levels']},{data['city']}\n")

print("Dataset saved to 'dataset.txt'")
