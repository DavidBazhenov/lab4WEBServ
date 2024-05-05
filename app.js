const express = require('express');
const bodyParser = require('body-parser'); 
const { Liquid } = require('liquidjs');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const { log } = require('console');

const app = express();
const engine = new Liquid({
    root: path.resolve(__dirname, 'views/'), 
    extname: '.liquid'  
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const session = require('express-session');
app.use(session({
    secret: 'secret', // Секретный ключ для подписи куки-сеанса
    resave: false,
    saveUninitialized: false
}));

// Middleware для проверки аутентификации пользователя
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

const sequelize = new Sequelize('tasks', 'postgres', 'admin',{
    dialect: 'postgres',
    host: 'localhost',
    port: 5432,
})

const User = sequelize.define('users', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }
},
{
    timestamps: false 
});

const Tasks = sequelize.define('tasks',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
            maxLength: 255
        },
        is_completed: {
            type: DataTypes.BOOLEAN,
            default: false,
            allowNull: false,
        }
    },
    {
        timestamps: false 
    }
)
app.engine('liquid', engine.express()); 
app.set('views', path.resolve(__dirname, 'views/'));
app.set('view engine', 'liquid');


app.get('/',async (req, res) => {
    res.redirect('/login');
});


// Вход пользователя
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ where: { username, password } });

    if (user) {
        req.session.user = user;
        res.redirect('/dashboard');
    } else {
        res.status(401).send('Неверный логин или пароль');
    }
});


// Выход пользователя
app.post('/logout', (req, res) => {
    // Удаляем пользовательский сеанс
    req.session.destroy();
    res.redirect('/');
});

// Регистрация пользователя
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        await User.create({ username, password });
        const user = await User.findOne({ where: { username, password } });

        if (user) {
            req.session.user = user;
            res.redirect('/dashboard');
        } else {
            res.status(401).send('Неверный логин или пароль');
        }
    } catch (error) {
        res.status(400).send('Ошибка при регистрации пользователя');
    }
});

// защищенный маршрут
app.get('/dashboard', requireAuth, async (req, res) => {
    const taskstodo = await Tasks.findAll({
        attributes: ['id', 'title', 'is_completed'],
        where: {is_completed: false}
      })
      const tasksDone = await Tasks.findAll({
        attributes: ['id', 'title', 'is_completed'],
        where: {is_completed: true}})
      res.render('index', { 
          layout: 'layout',  
          taskstodo: taskstodo,
          tasksDone: tasksDone
      });
});






app.post('/addTask', async (req, res) => {
  await Tasks.create({
      title: req.body.info,
      is_completed: false
  })
  res.redirect('/dashboard')
});

app.post('/deleteTask', async (req, res) => {
  await Tasks.destroy({
      where: {
          id: Number(req.query.id)
      },
  });
  res.redirect('/dashboard')
});

app.post('/completed', async (req, res) => {
    const taskId = Number(req.query.id);
    
    const task = await Tasks.findByPk(taskId);

    if (!task) {
        return res.status(404).send('Задача не найдена');
    }

    const newIsCompletedValue = !task.is_completed;

    await Tasks.update({ is_completed: newIsCompletedValue }, {
        where: { id: taskId }
    });

    res.redirect('/dashboard');
});  

app.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});
