const mongodb = require('mongodb');
const { MongoClient, ObjectId } = mongodb;
const express = require('express');
const bodyParser = require('body-parser');
const {graphqlExpress, graphiqlExpress} = require('graphql-server-express');
const { makeExecutableSchema } = require('graphql-tools');

const URL = 'http://localhost';
const PORT = process.env.PORT || 3001;
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'blog';

const id2String = o => {
  o._id = o._id.toString();
  return o;
};
const init = async () => {
  try {
    const c = await MongoClient.connect(MONGO_URL, { useNewUrlParser: true });
    const db = c.db(DB_NAME);
    const Posts = db.collection('posts');
    const Comments = db.collection('comments');
    // FIXME: do we need the blank lines?
    const typeDefs = `
      type Query {
        post(_id: String): Post
        posts: [Post]
        comment(_id: String): Comment
      }

      type Post {
        _id: String
        title: String
        content: String
        comments: [Comment]
      }

      type Comment {
        _id: String
        postId: String
        content: String
        post: Post
      }

      type Mutation {
        createPost(title: String, content: String): Post
        createComment(postId:String, content: String): Comment
      }

      schema {
        query: Query
        mutation: Mutation
      }
    `;
    const resolvers = {
      Query: {
        post: async (root, { _id }) =>
          id2String(await Posts.findOne(ObjectId(_id))),
        posts: async () => (await Posts.find({}).toArray()).map(id2String),
        comment: async (root, { _id }) =>
          id2String(await Comments.findOne(ObjectId(_id))),
      },
      Post: {
        comments: async({ _id }) =>
          (await Comments.find({postId: _id}).toArray()).map(id2String),
      },
      Comment: {
        post: async({ postId }) => id2String(await Posts.findOne(ObjectId(_id)))
      },
      Mutation: {
        createPost: async (root, args, context, info) => {
          const res = await Posts.insert(args);
          return id2String(await Posts.findOne({ _id: res.insertedIds[0]}));
        },
        createComment: async (root, args) => {
          const res = await Comments.insert(args);
          return id2String(await Comments.findOne({ _id: res.insertedIds[0]}));
        }
      }
    };
    const schema = makeExecutableSchema({ typeDefs, resolvers });

    const app = express();
    app.use('/graphql', bodyParser.json(), graphqlExpress({schema}));
    app.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));
    app.listen(PORT, () => {
      console.log(`Visit ${URL}:${PORT}/graphiql`);
    });
  } catch (e) {
    console.error(e);
  }
};

init();
