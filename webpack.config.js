const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/skottie-player.ts',
  output: {
    path: path.resolve(__dirname, './dist'),
    publicPath: '/dist/',
    filename: 'skottie-player.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'file-loader',
        options: {name: '[name].[ext]?[hash]'}
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  devServer: {historyApiFallback: true, noInfo: true},
  performance: {hints: false},
  devtool: '#eval-source-map',
  plugins: [
    new CopyPlugin({
      patterns: [
        // { from: 'node_modules/canvaskit-wasm/bin/canvaskit.wasm', to: 'src/'},
        { from: 'node_modules/skottiekit-wasm/bin/skottiekit.wasm', to: 'src/'}
      ]
  })],
  node: {
    fs: 'empty'
  },
  mode: 'production'
}

if (process.env.NODE_ENV === 'production') {
  module.exports.devtool = '#source-map'
  // http://vue-loader.vuejs.org/en/workflow/production.html
  module.exports.plugins = (module.exports.plugins || []).concat([
    new webpack.DefinePlugin({'process.env': {NODE_ENV: '"production"'}}),
    new webpack.optimize.UglifyJsPlugin(
        {sourceMap: true, compress: {warnings: false}}),
    new webpack.LoaderOptionsPlugin({minimize: true})
  ])
}