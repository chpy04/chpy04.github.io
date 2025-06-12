# Convolutional Neural Network From Scratch

![image](/images/projects/numbers.png)

## Overview

This convolutional nerual network was built froms scratch in python using exclusively math libraries. It features both dense and convolution layers that use backpropogation calculus and gradient descent. The project was tested on the mnist handwritten number dataset, and achieved an accuracy of 97.98%.

## Network Properties

- This neural network uses stochastic gradient descent to optomize a cost function and learn how to recognize handwritten digets.
- The network has two mprimary layers, dense layers which are good at detecting patterns between independent variables, and convolution layers which are good at detecting patterns in images.
- The network also has additional layers such as activation layers, reshaping layers, and pooling layers.
- All of these layers are module, so the network will work with any combination, shape, and number of these layers.
- The best performing network was able to classify the handwritten digits in a test set with an accuracy of 97.98%.

## Skills Demonstrated

- **Understanding of Neural Network Functionality**: This project required a deep understanding of the inner workings of convolutional neural networks, including cost functions, backpropogation, and matrix computations.
- **Math Intensive Coding and Debugging**: With heavily math based operations and lots of room for small errors, there was significant work put into accurately testing and ensuring that the network functioned properly.
- **Modular Design and Adjustability**: Different problems require different layers, sizes, and parameters. All of the code for this project was designed to be as modular and adjustable as possible.

## How Stochastic Gradient Descent Models Work

- Stochastic Gradient Descent (SDG) passes inputs through a series of computations (layers) to produce an output.
- Inputs, layers, and outputs consist of neurons, which are "activated" on a scale from 0 to 1.
- These layers consist of variables which effect the computation on the outputs, which are adjusted to let the network "learn".
- Because all the computations are continuous, they can be adjusted using their derivatives to slowly decrease a cost function which determines how good the network is, a process known as gradient descent.

## Error BackPropogation

- Because layers are often stacked on top of each other, many parameters effect the cost through many other layers. To find the partial derivative of these parameters, the chain rule is used.
- If you have a parameter P, a neuron activation N, and a cost C:
  $$
  \begin{equation}
    {∂C \over ∂N}{∂N \over ∂P} = {∂C \over ∂P}
  \end{equation}
  $$
- The derivative with respect to the output of the previous layer is known as the error. The process then repeats for as many layers as the network has; backpropagating the error.
- With the error, each parameter can be moved a small amount to reduce the error. The ammount each is moved is known as the learning rate.
- This idea of propogating the error backwards from the end of the network is core to how SDGs work, and fundamentally boils down to one line of code:

```python
for layer in reversed(self.network):
    vector = layer.backpropogateError(vector, learningRate/batchSizes, pushUpdate)
```

## Cost Function

A critical part of gradient descent is having a function to optimize. This function determines how good a given network is at a given task, and is known as the cost function. In the case of identifying numbers, the network has 10 output nodes, of which the node with the highest activation determines the networks "choice". The cost function would take these 10 values and compare them to the ideal 10 values for that image (if the image was 2, the ideal 10 values would be [0, 0, 1, 0, . . . , 0]). Two types of cost functions were made that can be used for this network, [quadratic and cross-entropy](https://medium.com/machine-learning-for-li/a-walk-through-of-cost-functions-4767dff78f7), which compare actual and expected results. The functions (and their derivatives for the backpropogation) are as follows:

```python
def costFunc(self, expected, actual, costType='crossEntropy'):
    if costType == 'quadratic':
        result = 0.0
        for _ in expected:
            result+=(actual-expected)
        result/=len(expected)
        return -.5*(result**2)

    elif costType=='crossEntropy':
        return np.sum(np.nan_to_num(-actual*np.log(expected)-(1-actual)*np.log(1-expected)))

def costPrime(self, expected, actual, Zs, costType='crossEntropy'):
    if costType == 'quadratic':
        return ((actual-expected)*self.sigmoidPrime(Zs))
    elif costType == 'crossEntropy':
        return (actual-expected)
```

## Dense Layers

- Dense layers connect any number of inputs to any number of outputs by multiplying by a weight matrix and adding a bias to each result.
- For example, a dense layer than had 10 inputs and 2 outputs would multiply the [1x10] input matrix by a [10x2] weight matrix, and add a [1x2] bias matrix to produce a [1x2] result. In practice, the relevant code for a dense layer looks like:

```python
//forward passing through network
return np.dot(self.weights, self.inputs) + self.biases

//computing the partial derivative with respect to the weights
weightVector = np.dot(error, np.transpose(self.inputs))

//computing the error to pass to the next layer
return np.dot(np.transpose(self.weights), error)
```

## Convolutional Layers

- Dense layers treat variables as independent, but pixels are not independent, which is where convolution layers come in.
- In a convolutional layer, filters are put over different parts of the image to assess how well that part of the image matches up with the filter.
- For example, a [2x2] filter could be passed over a [4x4] array of pixels, and multiplying and adding corresponding numbers for every position of the filter would give [3x3] result. The code for this convolution process looks like:

```python
//layer is the input image, and filter is the filter
for i in range(xoffset, len(layer)-offset):
    for j in range(yoffset, len(layer[i])-yoffset):
        value = 0
        for x in range(len(filter)):
            for y in range(len(filter[x])):
                value += layer[i+x-offset][j+y-offset]*filter[x][y]
        if total:
            output[i-xoffset][j-yoffset] = value
```

- Backpropogation through this network is much more complicated, and involves some confusing back to understand. A good explanation can be found [here](https://pavisj.medium.com/convolutions-and-backpropagations-46026a8f5d2c). In the end, the backpropogation code looks like:

```python
for i in range(self.depth):
    for j in range(self.inputDepth):
        filterVector[i, j] = self.convolute(self.input[j], error[i])
        intputVector[j] = self.fullFlippedConv(error[i], self.filters[i, j])

self.filterVectores -= learningRate * filterVector
self.biaseVectors -= learningRate * error
```

## Additional Layers

- **Activation Functions**: An [activation function](https://www.geeksforgeeks.org/activation-functions-neural-networks/) introduces non-linearity into the network to allow the network to to learn more complicated patterns. This project included both sigmoid and relu activation fucntions.
- **Pooling Layers**: Because convolutional layers often have many filters passing over the same image, the amount of data being processed can become very large, slowing the network down. To help this, pooling layers reduce the information in the filtered images, usually by averaging groups of 4 pixels and combining them into one data point.
- **Reshaping Layers**: This is a simple quality of life layer that helps to format between layers. For example, a convolu- tional layer might output a 10x7x7 array of neurons (10 filters on a 5x5 image) which can then be flattened into a 490 element array to be put in a dense network.

## Modular Approach

Because each of the layers explained here function independently of each other, there were all coded as independent classes. This makes it easy to change not just the size and user parameters of the network, but also the order and number of layers in any given network. For example, building a model might look like:

```python
convolutional_Network = [
    Reshape((784, 1), ((1, 28, 28))),
    Convolitional((1, 28, 28), 5, 32),
    Activation('relu'),
    AvPool([32, 24, 24], filterSize=[2, 2]),
    Reshape((32, 12, 12), (32*12*12, 1)),
    Dense(32*12*12, 10),
    Activation('sigmoid')
]
```

This sample model encorperates many different layers. Notice how the output of each layer corresponds to the input of the next layer, and overall the network takes in 784 input pixels (28x28 image) and has 10 outputs for numbers 0 through 9.

While all the settings in this project are well researched and have known strengths and weaknesses, it is still fascinating to see those same results from self conducted testing. For example, using a standard convolutional network with 5x5 filters, a depth of 10, and a pooling layer, many different learning rates were tested:

![image](/images/projects/learningRates.png)

There is a clear sweet spot for the learning rate at about 0.15. This curve happens because too low of a learning rate causes the network to get stuck in small local minimums, while too high learning rates skip back and forth across minimums never reaching the bottom.

Dense networks sizes were also compared. Using a dense network with 784 starting neurons, a hidden layer of x neurons, and a final layer of 10 neurons, this chart displays how adding more neurons changes the networks performance:

![image](/images/projects/denseNeurons.png)

The chart shows that there is initially a clear relationship between adding neurons and performance, but at some point this is no longer the case. This is a clear example of why bigger networks are not always better.

Using similar methods to the two examples above, it was also found that RELU activations narrowly out preformed sigmoid activations in larger networks, cross entropy was significantly better than quadratic cost, the ideal filter size is between 3 and 5, and a batch size of 10-15 was best for optimizing time and performance. Finally, using the model shown in the code above, the best network was able to classify images with an accuracy of 97.98%.

Overall this project was successful in its goal of creating a convolutional neural network from scratch. The resulting network was able to classify digits from the mnist data set with an accuracy of 97.98%, and compare many different types of CNN's and learning settings. It has led to a deeper understanding of how neural networks function at their core and how one type of machine learning solves problems.
