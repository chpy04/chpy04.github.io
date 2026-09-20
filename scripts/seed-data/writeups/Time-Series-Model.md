# Time Series ML Model to Predict Ecuadorian Store Sales

![image](/images/projects/gradient.png)

## Overview

A time-series forecasting machine learning model to forecast store sales on data from Corporación Favorita, a large Ecuadorian-based grocery retailer. Uses many different ML techniques including data analysis, encoding, regression trees, seasonality, and ridge regression.

## Model Properties

This model aimed to predict store sales for various different products given a variety of data. In practice, a model like this could help optomize inventory and logistics, decrease food waste, and lower consumer prices. The main topics explored in this project include:

- Exploratory Data Analysis (EDA) to determine best approach
- Encoding: the process of turning categorical data points into numerical ones that can be processed by a model.
- Testing and exploring a variety of different models to produce optimal results
- Adding features to work with trends over time

## Skills Demonstrated

- **Data Analysis**: Required work with large amounts of data. Cleaning, refactoring, and modifying this data properly was necessary for success.
- **Machine Learning Techniques**: Learned about and implemented many different machine learning techniques which lead to a deep understanding of how time series models function.
- **Trial and Error Approach**: This project involved testing with many different tecchniques and seeing what worked, which meant developing quick solutions for testing and thorough solutions for the final product.

## Data Cleaning

This project began with a lot of data, much of which had to be processed. The data supplied for this project was incredibly detailed, ranging from the price of oil at any given time to clusters of stores around the countrie to local and regional holidays. All of this had to at a minimum be converted into numerical data, and in many cases also processed with other tools. Below is a snap shot of what some of this data looked like.

![image](images/projects/mldata.png)

The most essential part of data cleaning is converting all of the data into numerical data, as a model cannot take in the name of a city as an input for example. To do this, non-numerical data must be encoded into numbers. There are many ways to do this, but some approaches are much better than others depending on your data. We tried the following three methods, and settled on a mix of one-hot encoding and target mean encoding depending on the type of data we were dealing with.

- Method 1: Ordinal Encoding
  - For every value, assign a unique integer based on its "importance"
  - Pros: uses least memory, easy to implement
  - Cons: Only works for values that can be ranked easily
- Method 2: One-Hot Encoding
  - For every value, there is a field for each data point representing either "has this value": 1 or "doesn't have this value": 0
  - Pros: works well for values with equal importance
  - Cons: impractical for large set of values, increases memory and training time
- Method 3: Target Mean Encoding
  - For every value, encode it as the mean of another numerical value related to it (for example families of products could be encoded as the average number of sales in that famil as seen below)
  - Pros: low memory cost and fast training times
  - Cons: reduces data to one dimentional relationship

Below are visualizations of these three methods, Ordinal (top), One-Hot (middle), and Target Mean (bottom).

<div style="display: flex; justify-content: space-between;">
  <img src="/images/projects/ordinal.png" alt="Image 1" style="height: 250px; object-fit: cover; border: 2px solid #000;">
  <img src="/images/projects/oneHot.png" alt="Image 2" style="height: 250px; object-fit: cover; border: 2px solid #000;">
</div>
<img src="/images/projects/targetMean.png" alt="Description" width="100%" style="border: 2px solid #000; padding: 5px;">

## Choosing a Model

![image](images/projects/xgboost.png)

For this problem, we settled on utilizing xgbost to build our model. There are many things that make this model an excellent candidate for any project, but one of the main things that likely set it appart from other methods that we tried was its ability to utilize regression trees and random forests.

<div style="display: flex; justify-content: space-between;">
  <img src="/images/projects/regressionTree.png" alt="Image 1" style="height: 250px; object-fit: cover; border: 2px solid #000;">
  <img src="/images/projects/randomForest.png" alt="Image 2" style="height: 250px; object-fit: cover; border: 2px solid #000;">
</div>

As seen in the first image above, a regression tree is a tree of decisions that can be ran through to reach a conclusion. In the example above, it is used to determine the effectiveness of a drug, which might be an example of how human made decision trees work. However, ML models can also create regression trees, which are particularly powerful when combined with random forests, shown in the second image. Random forsts are a method by which models randomly generate regression trees and modify them to become better and better using gradient decent. There is a lot of advanced math hidden within the model, but the image below provides some surface level insights into this process.

![image](images/projects/gradientBoosting.png)

The last step of using this model is hypertuning. Because the model takes in a number of different parameters to determine how it learns, hypertuning allows us to try out a range of these parameters and hone in on the ones that produce the best result.

## Trend and Seasonality

So far, the model could be used for any kind of data. But there are many properties of temporal data that can be taken advantage of. For example, we would expect people to shop more on the weekend, or during holidays. To take these factors into consideration, we need to look at trends over time within the data.

<div style="display: flex; justify-content: space-between;">
  <img src="/images/projects/periodogram.png" alt="Image 1" style="height: 250px; object-fit: cover; border: 2px solid #000;">
  <img src="/images/projects/seasonal.png" alt="Image 2" style="height: 250px; object-fit: cover; border: 2px solid #000;">
</div>

- In the first image, a periodogram provides valuable data about what time periods the data with. It does this by fitting sin waves with different periods to the data, and graphing how well the sin wave matches the data. As expected, there is a large spike in the weekly period, but there are also other spikes that can be used to increase the accuracy of the model.
- In the second image, some plots of total sales allow us to directly see the trends followed across the whole year or each week. If we were unsure whether or not there would be temporal trends in the data, this would be one way to look and see.

To actually improve the model with this information, we use fourier features. These are combinations of sin and cosine curves that allow the model to fit to the data, as seen below. The number sin and cos functions determine the accuracy of the curve, but more functions comes at the cost of computation and overfitting. We ended up using 3 sin/cos pairs.

![image](images/projects/fourier.png)

Implementing time series attributes in our model more than doubled its effectiveness, which shows how important these ideas are when it comes to machine learning. In the end, our model placed in the top 20 of 603 participants in the kaggle competition we entered, performing only 9% worse than the best model.

\*This project was done in collaboration with [Artur Savchii](https://www.linkedin.com/in/artur-savchii/) and [David Simane](https://www.linkedin.com/in/david-simane-63557929a/)\*
