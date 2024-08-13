const _ = require('lodash');
const moment = require('moment');
const axios = require('axios');


// Create an Axios instance with a custom timeout
const axiosInstance = axios.create({
    timeout: 10000 // Set timeout to 10 seconds
  });
  
  // Function to fetch data with retries
  const fetchDataWithRetries = async (url, retries = 3) => {
    try {
      console.info(`Trying ${url}`);
      return await axiosInstance.get(url);
    } catch (error) {
      if (retries > 0) {
        console.warn(`Retrying... (${retries} retries left)`);
        return fetchDataWithRetries(url, retries - 1);
      } else {
        throw error;
      }
    }
  };
  
async function fetchDataFromUrl(url, limit = 300, maxRecords = 1200) {
    let offset = 0;
    let retrievedRecords = 0;
    let totalRecords = 0;
    let allResults = [];

    try {
      while (retrievedRecords < maxRecords) {
        const paginatedUrl = `${url}&limit=${limit}&offset=${offset}`;
  
        let response;
        try {
          response = await fetchDataWithRetries(paginatedUrl); // Fetch with retry logic
        } catch (err) {
          console.error('Error fetching data from URL:', err.message);
          if (retrievedRecords > 0){
            return { totalRecords, retrievedRecords, allResults }
          } else{
            return {undefined, undefined, undefined}; // Return undefined if there's an error
          }
        }
  
        const { results, count, endOfRecords } = response.data;
        totalRecords = count;
  
        if (results && results.length > 0) {
          allResults = allResults.concat(results);
          retrievedRecords += results.length;
          offset += limit;
  
          if (retrievedRecords >= maxRecords || endOfRecords) {
            break; // Stop if maxRecords reached or no more records are available
          }
        } else {
            break; // Stop if there are no more results
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err.message);
      if (retrievedRecords > 0){
        return { totalRecords, retrievedRecords, allResults }
      } else{
        return {undefined, undefined, undefined}; 
      }
    }
    return { totalRecords, retrievedRecords, allResults };
}

// Export the functions
module.exports = {
    metrics
};

// Function to get dataset titles
async function getDatasetTitles(topDatasets) {
    const datasetPromises = topDatasets.map(async (dataset) => {
        try {
            const response = await axios.get(`https://api.gbif.org/v1/dataset/${dataset.datasetKey}`);
            return {
                datasetKey: dataset.datasetKey,
                title: response.data.title || 'No Title',
                count: dataset.count,
            };
        } catch (error) {
            return {
                datasetKey: dataset.datasetKey,
                count: dataset.count,
            };
        }
    });

    return await Promise.all(datasetPromises);
}

function generateChartUrl(title, label, data, type) {
    // Convert the data object into arrays for labels and values
    const entries = Object.entries(data)
    .filter(([key, value]) => key !== undefined && value !== undefined && key !== 'undefined' && key !== 'NaN');
    const labels = entries.map(([key]) => key);
    const values = entries.map(([_, value]) => value);
  
    // Create the chart configuration object
    const chartConfig = {
      type: type,
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: values
        }]
      },
      options: {
        title: {
          display: true,
          text: title
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        }
      }
    };
  // Generate the QuickChart URL
  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

  return chartUrl;
}

const checkType = (value) => {
    if (value === null) {
      return 'null'; // Special case for null
    }
    if (Array.isArray(value)) {
      return 'array'; // Special case for arrays
    }
    return typeof value; // Use typeof for other types
  };

function selectThreatenedSpecies(speciesStatusMap) {
    const threatOrder = {
      'Critically Endangered': 1,
      'Endangered': 2,
      'Vulnerable': 3,
      'Near Threatened': 4,
      'Least Concern': 5,
      'Unknown': 6
    };
  
    // Convert the speciesStatusMap object into an array of [species, status] pairs
    const speciesArray = Object.entries(speciesStatusMap);
  
    // Sort the species array by threat level
    speciesArray.sort((a, b) => threatOrder[a[1]] - threatOrder[b[1]]);
  
    // If there are more than 10 species, select the top 10 most threatened ones
    if (speciesArray.length > 5) {
      return speciesArray.slice(0, 5);
    }
  
    // If there are 10 or fewer species, return the entire list
    return speciesArray;
  }

// Function to process metrics
async function metrics(url) {

    // Await the result of fetchDataFromUrl
    const {totalRecords, retrievedRecords, allResults} = await fetchDataFromUrl(url);
    console.log(totalRecords)
    console.log(checkType(allResults)); 

    // Check if result is undefined
    if (totalRecords == undefined || totalRecords === undefined || !totalRecords) {
        console.log('Error fetching data or no data available.');
        return undefined;
    }

    // Helper function to parse date
    const parseDate = (dateString) => {
        if (dateString === undefined || dateString === null) {
          return undefined; // Return undefined if dateString is not valid
        }
      
        try {
          // Convert dateString to a string and split by '/'
          const firstPart = String(dateString).split('/')[0];
          
          // Attempt to parse the date
          return moment(firstPart).toDate();
        } catch (error) {
          console.error('Error parsing date:', error.message);
          return undefined; // Return undefined if parsing fails
        }
      };

    // Array of month names
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Occurrences per month
    const occurrencesPerMonth = _.countBy(allResults, (item) => {
        const date = parseDate(item.eventDate);
        return date ? monthNames[date.getMonth()] : undefined; // Get month name from month number
    });
    const occurrencesPerMonthChartUrl = generateChartUrl("Monhtly data","month", occurrencesPerMonth, 'bar')

    // Occurrences per basis of record
    const occurrencesPerBasis = _.countBy(_.flatMap(allResults, 'basisOfRecord'));

    // Occurrences per issues
    const occurrencesPerIssues = _.countBy(_.flatMap(allResults, 'issues'));

    // Occurrences per year
    const occurrencesPerYear = _.countBy(allResults, (item) => {
        const date = parseDate(item.eventDate);
        return date ? date.getFullYear() : undefined;
    });
    const occurrencesPerYearChartUrl = generateChartUrl("Yearly data","year", occurrencesPerYear, 'line')

    // Updated mapping object for license URLs
    const licenseMap = {
        'http://creativecommons.org/licenses/by-nc/4.0/legalcode': 'Creative Commons Attribution-NonCommercial 4.0 International License',
        'http://creativecommons.org/licenses/by/4.0/legalcode': 'Creative Commons Attribution 4.0 International License',
        'http://creativecommons.org/publicdomain/zero/1.0/legalcode': 'Creative Commons Zero (CC0) 1.0 Universal License',
        'http://creativecommons.org/licenses/by-nc/4.0/': 'Creative Commons Attribution-NonCommercial 4.0 International License',
        'http://creativecommons.org/licenses/by/4.0/': 'Creative Commons Attribution 4.0 International License',
        'http://creativecommons.org/publicdomain/zero/1.0/': 'Creative Commons Zero (CC0) 1.0 Universal License'
        // Add more mappings as needed
    };

    // Convert URLs to names and count occurrences
    const occurrencesPerLicense = _.countBy(_.flatMap(allResults, (record) => {
        const licenseName = licenseMap[record.license] || 'Unknown License';
        return licenseName;
    }));

    // Occurrences per dataset
    const occurrencesPerDatasetCounts = _.countBy(allResults, 'datasetKey');
    const occurrencesPerDatasetArray = _.map(occurrencesPerDatasetCounts, (count, datasetKey) => ({
        datasetKey,
        count
    }));
    const topDatasets = _.orderBy(occurrencesPerDatasetArray, ['count'], ['desc']).slice(0, 5);

    const datasetsWithTitles = await getDatasetTitles(topDatasets);

    // Geographical Distribution
    const locations = allResults.map(record => ({
        country: record.country,
        stateProvince: record.stateProvince,
        count: 1
    }));

        let minLat = Infinity;
        let minLng = Infinity;
        let maxLat = -10000000;
        let maxLng = -10000000;

        

    const clusterCoordinates = (allResults, precision) => {
        const clusters = {};
        
    
        allResults.forEach(record => {
            // Round the coordinates to the specified precision
            try{
            const lat = parseFloat(record.decimalLatitude.toFixed(precision));
            const lon = parseFloat(record.decimalLongitude.toFixed(precision));

            if(lat>maxLat){
                maxLat=lat;
            }
            if(lon>maxLng){
                maxLng=lon;
            }
            if(lat<minLat){
                minLat=lat;
            }
            if(lon<minLng){
                minLng=lon;
            }

            
    
            // Create a key for the cluster
            const key = `${lon},${lat}`;
    
            // Initialize the cluster if it doesn't exist
            if (!clusters[key]) {
                clusters[key] = { lat, lon, count: 0 };
            }
    
            // Increment the count of points in this cluster
            clusters[key].count++;
        }catch(e){

        }
        });
    
        // Convert clusters to an array of coordinates strings
        const clusteredCoordinates = Object.values(clusters).map(cluster => 
            `(${cluster.lon},${cluster.lat})`
        );
    
        return clusteredCoordinates;
    }



    const precision = 2; // Adjust precision for clustering size
    const coordinates = clusterCoordinates(allResults, precision);

    // const coordinates = allResults.map(record => 
    //      `(${record.decimalLatitude},${record.decimalLongitude})`
    // );

    const aggregated = locations.reduce((acc, loc) => {
        const key = `${loc.country}-${loc.stateProvince}`;

        if (!acc[key]) {
            acc[key] = { country: loc.country, stateProvince: loc.stateProvince, count: 0 };
        }

        acc[key].count += loc.count;

        return acc;
    }, {});

    const uniqueLocations = Object.values(aggregated);
    const top10UniqueLocations = _.orderBy(uniqueLocations, ['count'], ['desc']).slice(0, 10);


    // Species and Taxonomy
    const speciesDistribution = _.countBy(allResults, 'scientificName');

    // Mapping object for IUCN conservation statuses
    const iucnStatusMap = {
        'LC': 'Least Concern',
        'NT': 'Near Threatened',
        'VU': 'Vulnerable',
        'EN': 'Endangered',
        'CR': 'Critically Endangered',
        'EW': 'Extinct in the Wild',
        'EX': 'Extinct',
        'DD': 'Data Deficient'
    };

    // Summarize conservation statuses by scientific name without repetition
    const conservationList = _.mapValues(_.groupBy(allResults, 'scientificName'), (records) => {
        const statuses = records.map(record => iucnStatusMap[record.iucnRedListCategory] || 'Unknown');
        return _.uniq(statuses)[0]; // Return the first unique status
    });

    const top5ThreatenedSpecies = selectThreatenedSpecies(conservationList)

    // Media Types
    let mediaTypes = _.flatMap(allResults, record => record.media.map(media => media.type));
    let mediaTypeCounts = _.countBy(mediaTypes);

    // Contributor Analysis
    let recordedByCounts = _.countBy(allResults, 'recordedBy');
    let recordedByArray = _.map(recordedByCounts, (count, recordedBy) => ({
        recordedBy,
        count
    }));
    let topRecordedBy = _.orderBy(recordedByArray, ['count'], ['desc']).slice(0, 5);

    // Function to find the first media identifier
    let findFirstMedia = () => {
        for (let record of allResults) {
            if (record.media && record.media.length > 0 && record.media[0].identifier) {
                return record.media[0];
            }
        }
        return null;
    };
    let media = await findFirstMedia();
    let firstMedia = media ? {
        ...media,
        licenseName: media.license ? (licenseMap[media.license] || 'Unknown License') : 'No License'
    } : null;

    r = {
        totalRecords,
        retrievedRecords,
        occurrencesPerMonth,
        occurrencesPerMonthChartUrl,
        occurrencesPerBasis,
        occurrencesPerYear,
        occurrencesPerYearChartUrl,
        top5Datasets: datasetsWithTitles,
        top10UniqueLocations,
        top5ThreatenedSpecies,
        topRecordedBy,
        coordinates,
        firstMedia,
        maxLat,
        maxLng,
        minLat,
        minLng,
        occurrencesPerIssues,
        occurrencesPerLicense,
        mediaTypeCounts
    }
    return r;
}

// Example jaguar
metrics('https://api.gbif.org/v1/occurrence/search?&country=CO&taxonKey=5219426').then(results => {
    if(results){
        console.log(results.totalRecords)
    }
});



