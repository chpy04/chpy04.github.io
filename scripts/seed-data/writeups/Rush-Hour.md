# Rush Hour Game

![image](/images/projects/RH.gif)

## Overview

This block based puzzle game consists of a size-adjustable game with various pieces, all of which can move in only certain directions. The aim of the game is to get the red target piece through the black exit.

## Gameplay

- Board can be any size or shape, as long as it is made of blocks. Every board has one exit on it denoted by the black square.
- There are three types of pieces, a target piece, cars, and trucks.
  - The target piece is 2 blocks long and either horizontal or vertical.
  - Trucks are 3 blocks long and either horizontal or vertical.
  - Cars are 2 blocks long and either horizontal or vertical.
- All pieces can only move forward or backward in the direction they are facing.
- Pieces and walls cannot collide with each other, only the target piece can enter the exit, at which point the game is won.

## Skills Demonstrated

- **Object Oriented Design**: Various different objects that interact with each other and are all controlled in a game class. Allows for customizability while also preventing impossible game states.
- **Flexible Programming**: Started off with minimum viable game, and worked up in complexity adding features. This forced the design to be flexible and easy to modify/work with.
- **Control Over Aliasing and Mutability**: Utilized aliasing and mutable states to simplify code. Involved keeping track of objects and understanding of Java mutibility.
- **User Interface**: Needed easy way to build and play complex levels, ended up using text parser. Also required work with game display and mouse/keyboard controls.

## Data Structure

The class structure of this game was designed as follows:

- Level: Controls all gameplay, pieces, and functionality
- Piece (Abstract): represents any piece or wall in the game.
  - Vehicle (extends Piece): represents cars or trucks that move horizontally or vertically.
  - Exit (extends Piece): represents the exit of the game.
  - Wall (extends Piece): represents wall on the edge that cannot move.
- Interval: represents the space that any piece occupies and handles collisions and drawing.
- Move: represents a move by the player that is stored to allow for undoing moves.

Because there can be any number of pieces in a given game, and it is useful to be able to access all the pieces at once for collision purposes, the Level object has an arrayList\<Piece> of all the pieces. However, because it is also useful to be able to access the selected, target, and exit pieces individually, they are also fields of the Level object. For all three of these, one piece is aliased as both a piece in the pieces array list, and an individual field. This aliasing is best understood in the diagram below:

```
                     +-------------------+
                     |       Level       |
                     | selectedPiece  ---|--------+
                     | targetPiece  -----|---+    |
                     | exitPiece  -------|-+ |    |
                 +---|--- pieces         | | |    |
                 |   +-------------------+ | |    |
       	         |           +-------------+ |	  |
       	         |           |	             |    |
       	         |           |	       +-----+	  |
       	         |           |	       |          |
       	         |           |	       |          |
    ArrayList of Pieces:     |         |          |
    +------------------------+---------+----------+-----------------------+
    |         |         |    |    |    |    |     |   |         |         |
    |         |         |    |    |    |    |     |   |         |         |
    | Apiece1 | Apiece2 | Apiece3 | Apiece4 | Apiece5 | Apiece6 | Apiece7 |
    |         |         |         |         |         |         |         |
    |         |         |         |         |         |         |         |
    +---------------------------------------------------------------------+
```

## Other Relvant Design Decisions

- Every Piece has an Interval field, which allows all of the collision and drawing code to be universal for every piece.
- In order to easily create new levels, a text parser takes in a string and constructs levels using it. A sample string would look like:

```
String testlvl = "|||----+\n"
                 + "|||t  T|\n"
                 + "|| C   |\n"
                 + "|g     X\n"
                 + "|t     |\n"
                 + "|    C  |\n"
                 + "|     c  |\n"
                 + "+--------+";
```

Where t or c correspond to trucks or cars, g is the target car, the capitalization determines the orientation, and X is the exit.

- In order to support undos, a Previous Move object stores a given piece, and a copt of the interval that it started at for a given move. Then, to undo moves, the level stores an array list of all the previous moves, moving pieces back to their original internvals. This saves space as only one interval must be stored for every move.
- There are many checks in the level class that ensure that impossible states of the game are not reached. These were useful in the development process particularly with the aliasing of the pieces.

## Additional Functionality

- As a variation on this game, a version was made that allows for any size pieces that can move horizontally or vertically.<br />
  ![gif](/images/projects/klotski.gif)
- This second version was also made only using additional classes that extend a Piece, so a game with a combination of rules could aso be made.
- The game has a move counter in the top left that keeps track of the number of moves the player has made. Undoing does not decrease this move counter

\*This project was done in collaboration with [Zach Croft](https://www.linkedin.com/in/zachary-croft-67316b298/)\*
