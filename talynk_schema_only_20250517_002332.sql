--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8 (Debian 16.8-1.pgdg120+1)
-- Dumped by pg_dump version 17.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: talynk_k5dt_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO talynk_k5dt_user;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: enum_ads_status; Type: TYPE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TYPE public.enum_ads_status AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.enum_ads_status OWNER TO talynk_k5dt_user;

--
-- Name: enum_users_status; Type: TYPE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TYPE public.enum_users_status AS ENUM (
    'active',
    'inactive',
    'banned'
);


ALTER TYPE public.enum_users_status OWNER TO talynk_k5dt_user;

--
-- Name: post_status; Type: TYPE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TYPE public.post_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE public.post_status OWNER TO talynk_k5dt_user;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'approver',
    'user'
);


ALTER TYPE public.user_role OWNER TO talynk_k5dt_user;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE public.user_status OWNER TO talynk_k5dt_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_management; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.account_management (
    "accountID" character varying(255) NOT NULL,
    account_status character varying(50),
    freeze_date timestamp with time zone,
    delete_date timestamp with time zone
);


ALTER TABLE public.account_management OWNER TO talynk_k5dt_user;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.admins (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'admin'::character varying,
    status public.user_status DEFAULT 'active'::public.user_status,
    permissions jsonb DEFAULT '{}'::jsonb,
    can_view_approved boolean DEFAULT true,
    can_view_pending boolean DEFAULT true,
    can_view_rejected boolean DEFAULT true,
    ads_management boolean DEFAULT true,
    can_view_all_approvers boolean DEFAULT true,
    can_register_approvers boolean DEFAULT true,
    can_manage_all_accounts boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    lastloginat timestamp without time zone
);


ALTER TABLE public.admins OWNER TO talynk_k5dt_user;

--
-- Name: ads; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.ads (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text,
    status character varying(255) DEFAULT 'active'::character varying,
    "userId" uuid NOT NULL,
    "startDate" timestamp without time zone,
    "endDate" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ads OWNER TO talynk_k5dt_user;

--
-- Name: ads_id_seq; Type: SEQUENCE; Schema: public; Owner: talynk_k5dt_user
--

CREATE SEQUENCE public.ads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ads_id_seq OWNER TO talynk_k5dt_user;

--
-- Name: ads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: talynk_k5dt_user
--

ALTER SEQUENCE public.ads_id_seq OWNED BY public.ads.id;


--
-- Name: approvers; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.approvers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'approver'::character varying,
    status public.user_status DEFAULT 'active'::public.user_status,
    registered_by uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    can_view_approved boolean DEFAULT true,
    can_view_pending boolean DEFAULT true,
    can_view_all_accounts boolean DEFAULT true,
    "registeredBy" character varying(255),
    "lastLoginAt" timestamp without time zone
);


ALTER TABLE public.approvers OWNER TO talynk_k5dt_user;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status character varying(255) DEFAULT 'active'::character varying
);


ALTER TABLE public.categories OWNER TO talynk_k5dt_user;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: talynk_k5dt_user
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO talynk_k5dt_user;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: talynk_k5dt_user
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.comments (
    comment_id integer NOT NULL,
    commentor_id uuid NOT NULL,
    comment_date timestamp without time zone DEFAULT now(),
    post_id text NOT NULL,
    comment_text text,
    comment_reports integer DEFAULT 0
);


ALTER TABLE public.comments OWNER TO talynk_k5dt_user;

--
-- Name: comments_comment_id_seq; Type: SEQUENCE; Schema: public; Owner: talynk_k5dt_user
--

CREATE SEQUENCE public.comments_comment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_comment_id_seq OWNER TO talynk_k5dt_user;

--
-- Name: comments_comment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: talynk_k5dt_user
--

ALTER SEQUENCE public.comments_comment_id_seq OWNED BY public.comments.comment_id;


--
-- Name: follows; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.follows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "followerId" uuid NOT NULL,
    "followingId" uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.follows OWNER TO talynk_k5dt_user;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.notifications (
    notification_id integer NOT NULL,
    user_id uuid NOT NULL,
    notification_text text,
    notification_date timestamp without time zone DEFAULT now(),
    is_read boolean DEFAULT false
);


ALTER TABLE public.notifications OWNER TO talynk_k5dt_user;

--
-- Name: userid; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.userid (
    notification_id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    notification_text text,
    notification_date timestamp without time zone DEFAULT now(),
    is_read boolean DEFAULT false
);


ALTER TABLE public.userid OWNER TO talynk_k5dt_user;

--
-- Name: notifications_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: talynk_k5dt_user
--

CREATE SEQUENCE public.notifications_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_notification_id_seq OWNER TO talynk_k5dt_user;

--
-- Name: notifications_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: talynk_k5dt_user
--

ALTER SEQUENCE public.notifications_notification_id_seq OWNED BY public.userid.notification_id;


--
-- Name: notifications_notification_id_seq1; Type: SEQUENCE; Schema: public; Owner: talynk_k5dt_user
--

CREATE SEQUENCE public.notifications_notification_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_notification_id_seq1 OWNER TO talynk_k5dt_user;

--
-- Name: notifications_notification_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: talynk_k5dt_user
--

ALTER SEQUENCE public.notifications_notification_id_seq1 OWNED BY public.notifications.notification_id;


--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.post_likes (
    user_id uuid NOT NULL,
    like_date timestamp without time zone DEFAULT now(),
    post_id uuid NOT NULL
);


ALTER TABLE public.post_likes OWNER TO talynk_k5dt_user;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.posts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    video_url character varying(255),
    status public.post_status DEFAULT 'pending'::public.post_status,
    user_id uuid,
    approver_id uuid,
    admin_id uuid,
    approved_at timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    unique_traceability_id character varying(255),
    views integer DEFAULT 0,
    likes integer DEFAULT 0,
    shares integer DEFAULT 0,
    category_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    comment_count integer DEFAULT 0
);


ALTER TABLE public.posts OWNER TO talynk_k5dt_user;

--
-- Name: recent_searches; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.recent_searches (
    id integer NOT NULL,
    user_id character varying(255),
    search_term text,
    search_date timestamp without time zone DEFAULT now()
);


ALTER TABLE public.recent_searches OWNER TO talynk_k5dt_user;

--
-- Name: recent_searches_id_seq; Type: SEQUENCE; Schema: public; Owner: talynk_k5dt_user
--

CREATE SEQUENCE public.recent_searches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recent_searches_id_seq OWNER TO talynk_k5dt_user;

--
-- Name: recent_searches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: talynk_k5dt_user
--

ALTER SEQUENCE public.recent_searches_id_seq OWNED BY public.recent_searches.id;


--
-- Name: shares; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.shares (
    id integer NOT NULL,
    "userId" uuid NOT NULL,
    "postId" uuid NOT NULL,
    "sharedAt" timestamp without time zone DEFAULT now()
);


ALTER TABLE public.shares OWNER TO talynk_k5dt_user;

--
-- Name: shares_id_seq; Type: SEQUENCE; Schema: public; Owner: talynk_k5dt_user
--

CREATE SEQUENCE public.shares_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shares_id_seq OWNER TO talynk_k5dt_user;

--
-- Name: shares_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: talynk_k5dt_user
--

ALTER SEQUENCE public.shares_id_seq OWNED BY public.shares.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.subscriptions (
    subscriber_id uuid NOT NULL,
    subscribed_to uuid NOT NULL,
    subscription_date timestamp without time zone DEFAULT now()
);


ALTER TABLE public.subscriptions OWNER TO talynk_k5dt_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(255) DEFAULT 'user'::character varying,
    status character varying(255) DEFAULT 'active'::character varying,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    phone1 character varying(15),
    phone2 character varying(15),
    posts_count integer DEFAULT 0,
    total_profile_views integer DEFAULT 0,
    user_facial_image bytea,
    selected_category character varying(255),
    notification boolean DEFAULT true,
    recent_searches text[] DEFAULT ARRAY[]::text[],
    likes integer DEFAULT 0,
    subscribers integer DEFAULT 0,
    remember_me boolean DEFAULT false,
    profile_picture character varying(255),
    bio text,
    last_login timestamp with time zone,
    last_active_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    follower_count integer DEFAULT 0,
    interests text[] DEFAULT '{}'::text[]
);


ALTER TABLE public.users OWNER TO talynk_k5dt_user;

--
-- Name: views; Type: TABLE; Schema: public; Owner: talynk_k5dt_user
--

CREATE TABLE public.views (
    id integer NOT NULL,
    "userId" uuid NOT NULL,
    "postId" uuid NOT NULL,
    "viewedAt" timestamp without time zone DEFAULT now()
);


ALTER TABLE public.views OWNER TO talynk_k5dt_user;

--
-- Name: views_id_seq; Type: SEQUENCE; Schema: public; Owner: talynk_k5dt_user
--

CREATE SEQUENCE public.views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.views_id_seq OWNER TO talynk_k5dt_user;

--
-- Name: views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: talynk_k5dt_user
--

ALTER SEQUENCE public.views_id_seq OWNED BY public.views.id;


--
-- Name: ads id; Type: DEFAULT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.ads ALTER COLUMN id SET DEFAULT nextval('public.ads_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: comments comment_id; Type: DEFAULT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.comments ALTER COLUMN comment_id SET DEFAULT nextval('public.comments_comment_id_seq'::regclass);


--
-- Name: notifications notification_id; Type: DEFAULT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.notifications ALTER COLUMN notification_id SET DEFAULT nextval('public.notifications_notification_id_seq1'::regclass);


--
-- Name: recent_searches id; Type: DEFAULT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.recent_searches ALTER COLUMN id SET DEFAULT nextval('public.recent_searches_id_seq'::regclass);


--
-- Name: shares id; Type: DEFAULT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.shares ALTER COLUMN id SET DEFAULT nextval('public.shares_id_seq'::regclass);


--
-- Name: userid notification_id; Type: DEFAULT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.userid ALTER COLUMN notification_id SET DEFAULT nextval('public.notifications_notification_id_seq'::regclass);


--
-- Name: views id; Type: DEFAULT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.views ALTER COLUMN id SET DEFAULT nextval('public.views_id_seq'::regclass);


--
-- Name: account_management account_management_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.account_management
    ADD CONSTRAINT account_management_pkey PRIMARY KEY ("accountID");


--
-- Name: admins admins_email_key; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_key UNIQUE (email);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);


--
-- Name: approvers approvers_email_key; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.approvers
    ADD CONSTRAINT approvers_email_key UNIQUE (email);


--
-- Name: approvers approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.approvers
    ADD CONSTRAINT approvers_pkey PRIMARY KEY (id);


--
-- Name: approvers approvers_username_key; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.approvers
    ADD CONSTRAINT approvers_username_key UNIQUE (username);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (comment_id);


--
-- Name: follows follows_followerId_followingId_key; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT "follows_followerId_followingId_key" UNIQUE ("followerId", "followingId");


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);


--
-- Name: userid notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.userid
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: notifications notifications_pkey1; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey1 PRIMARY KEY (notification_id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (user_id, post_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: posts posts_unique_traceability_id_key; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_unique_traceability_id_key UNIQUE (unique_traceability_id);


--
-- Name: recent_searches recent_searches_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.recent_searches
    ADD CONSTRAINT recent_searches_pkey PRIMARY KEY (id);


--
-- Name: shares shares_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (subscriber_id, subscribed_to);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_email_key1; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key1 UNIQUE (email);


--
-- Name: users users_email_key10; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key10 UNIQUE (email);


--
-- Name: users users_email_key100; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key100 UNIQUE (email);


--
-- Name: users users_email_key101; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key101 UNIQUE (email);


--
-- Name: users users_email_key102; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key102 UNIQUE (email);


--
-- Name: users users_email_key103; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key103 UNIQUE (email);


--
-- Name: users users_email_key104; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key104 UNIQUE (email);


--
-- Name: users users_email_key105; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key105 UNIQUE (email);


--
-- Name: users users_email_key106; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key106 UNIQUE (email);


--
-- Name: users users_email_key107; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key107 UNIQUE (email);


--
-- Name: users users_email_key108; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key108 UNIQUE (email);


--
-- Name: users users_email_key109; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key109 UNIQUE (email);


--
-- Name: users users_email_key11; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key11 UNIQUE (email);


--
-- Name: users users_email_key110; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key110 UNIQUE (email);


--
-- Name: users users_email_key111; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key111 UNIQUE (email);


--
-- Name: users users_email_key112; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key112 UNIQUE (email);


--
-- Name: users users_email_key113; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key113 UNIQUE (email);


--
-- Name: users users_email_key114; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key114 UNIQUE (email);


--
-- Name: users users_email_key115; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key115 UNIQUE (email);


--
-- Name: users users_email_key116; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key116 UNIQUE (email);


--
-- Name: users users_email_key117; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key117 UNIQUE (email);


--
-- Name: users users_email_key118; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key118 UNIQUE (email);


--
-- Name: users users_email_key119; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key119 UNIQUE (email);


--
-- Name: users users_email_key12; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key12 UNIQUE (email);


--
-- Name: users users_email_key120; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key120 UNIQUE (email);


--
-- Name: users users_email_key121; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key121 UNIQUE (email);


--
-- Name: users users_email_key122; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key122 UNIQUE (email);


--
-- Name: users users_email_key123; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key123 UNIQUE (email);


--
-- Name: users users_email_key124; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key124 UNIQUE (email);


--
-- Name: users users_email_key125; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key125 UNIQUE (email);


--
-- Name: users users_email_key126; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key126 UNIQUE (email);


--
-- Name: users users_email_key127; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key127 UNIQUE (email);


--
-- Name: users users_email_key128; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key128 UNIQUE (email);


--
-- Name: users users_email_key129; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key129 UNIQUE (email);


--
-- Name: users users_email_key13; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key13 UNIQUE (email);


--
-- Name: users users_email_key130; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key130 UNIQUE (email);


--
-- Name: users users_email_key131; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key131 UNIQUE (email);


--
-- Name: users users_email_key132; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key132 UNIQUE (email);


--
-- Name: users users_email_key133; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key133 UNIQUE (email);


--
-- Name: users users_email_key134; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key134 UNIQUE (email);


--
-- Name: users users_email_key135; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key135 UNIQUE (email);


--
-- Name: users users_email_key136; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key136 UNIQUE (email);


--
-- Name: users users_email_key137; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key137 UNIQUE (email);


--
-- Name: users users_email_key138; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key138 UNIQUE (email);


--
-- Name: users users_email_key139; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key139 UNIQUE (email);


--
-- Name: users users_email_key14; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key14 UNIQUE (email);


--
-- Name: users users_email_key140; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key140 UNIQUE (email);


--
-- Name: users users_email_key141; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key141 UNIQUE (email);


--
-- Name: users users_email_key142; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key142 UNIQUE (email);


--
-- Name: users users_email_key143; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key143 UNIQUE (email);


--
-- Name: users users_email_key144; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key144 UNIQUE (email);


--
-- Name: users users_email_key145; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key145 UNIQUE (email);


--
-- Name: users users_email_key146; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key146 UNIQUE (email);


--
-- Name: users users_email_key147; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key147 UNIQUE (email);


--
-- Name: users users_email_key148; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key148 UNIQUE (email);


--
-- Name: users users_email_key149; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key149 UNIQUE (email);


--
-- Name: users users_email_key15; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key15 UNIQUE (email);


--
-- Name: users users_email_key150; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key150 UNIQUE (email);


--
-- Name: users users_email_key151; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key151 UNIQUE (email);


--
-- Name: users users_email_key152; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key152 UNIQUE (email);


--
-- Name: users users_email_key153; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key153 UNIQUE (email);


--
-- Name: users users_email_key154; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key154 UNIQUE (email);


--
-- Name: users users_email_key155; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key155 UNIQUE (email);


--
-- Name: users users_email_key156; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key156 UNIQUE (email);


--
-- Name: users users_email_key157; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key157 UNIQUE (email);


--
-- Name: users users_email_key158; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key158 UNIQUE (email);


--
-- Name: users users_email_key159; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key159 UNIQUE (email);


--
-- Name: users users_email_key16; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key16 UNIQUE (email);


--
-- Name: users users_email_key160; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key160 UNIQUE (email);


--
-- Name: users users_email_key161; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key161 UNIQUE (email);


--
-- Name: users users_email_key162; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key162 UNIQUE (email);


--
-- Name: users users_email_key163; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key163 UNIQUE (email);


--
-- Name: users users_email_key164; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key164 UNIQUE (email);


--
-- Name: users users_email_key165; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key165 UNIQUE (email);


--
-- Name: users users_email_key166; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key166 UNIQUE (email);


--
-- Name: users users_email_key167; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key167 UNIQUE (email);


--
-- Name: users users_email_key168; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key168 UNIQUE (email);


--
-- Name: users users_email_key169; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key169 UNIQUE (email);


--
-- Name: users users_email_key17; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key17 UNIQUE (email);


--
-- Name: users users_email_key170; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key170 UNIQUE (email);


--
-- Name: users users_email_key171; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key171 UNIQUE (email);


--
-- Name: users users_email_key172; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key172 UNIQUE (email);


--
-- Name: users users_email_key173; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key173 UNIQUE (email);


--
-- Name: users users_email_key174; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key174 UNIQUE (email);


--
-- Name: users users_email_key175; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key175 UNIQUE (email);


--
-- Name: users users_email_key176; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key176 UNIQUE (email);


--
-- Name: users users_email_key177; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key177 UNIQUE (email);


--
-- Name: users users_email_key178; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key178 UNIQUE (email);


--
-- Name: users users_email_key179; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key179 UNIQUE (email);


--
-- Name: users users_email_key18; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key18 UNIQUE (email);


--
-- Name: users users_email_key180; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key180 UNIQUE (email);


--
-- Name: users users_email_key181; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key181 UNIQUE (email);


--
-- Name: users users_email_key182; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key182 UNIQUE (email);


--
-- Name: users users_email_key183; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key183 UNIQUE (email);


--
-- Name: users users_email_key184; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key184 UNIQUE (email);


--
-- Name: users users_email_key185; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key185 UNIQUE (email);


--
-- Name: users users_email_key186; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key186 UNIQUE (email);


--
-- Name: users users_email_key187; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key187 UNIQUE (email);


--
-- Name: users users_email_key188; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key188 UNIQUE (email);


--
-- Name: users users_email_key189; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key189 UNIQUE (email);


--
-- Name: users users_email_key19; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key19 UNIQUE (email);


--
-- Name: users users_email_key190; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key190 UNIQUE (email);


--
-- Name: users users_email_key191; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key191 UNIQUE (email);


--
-- Name: users users_email_key192; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key192 UNIQUE (email);


--
-- Name: users users_email_key193; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key193 UNIQUE (email);


--
-- Name: users users_email_key194; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key194 UNIQUE (email);


--
-- Name: users users_email_key195; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key195 UNIQUE (email);


--
-- Name: users users_email_key196; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key196 UNIQUE (email);


--
-- Name: users users_email_key197; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key197 UNIQUE (email);


--
-- Name: users users_email_key198; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key198 UNIQUE (email);


--
-- Name: users users_email_key199; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key199 UNIQUE (email);


--
-- Name: users users_email_key2; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key2 UNIQUE (email);


--
-- Name: users users_email_key20; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key20 UNIQUE (email);


--
-- Name: users users_email_key200; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key200 UNIQUE (email);


--
-- Name: users users_email_key201; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key201 UNIQUE (email);


--
-- Name: users users_email_key202; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key202 UNIQUE (email);


--
-- Name: users users_email_key203; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key203 UNIQUE (email);


--
-- Name: users users_email_key204; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key204 UNIQUE (email);


--
-- Name: users users_email_key205; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key205 UNIQUE (email);


--
-- Name: users users_email_key206; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key206 UNIQUE (email);


--
-- Name: users users_email_key207; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key207 UNIQUE (email);


--
-- Name: users users_email_key208; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key208 UNIQUE (email);


--
-- Name: users users_email_key209; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key209 UNIQUE (email);


--
-- Name: users users_email_key21; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key21 UNIQUE (email);


--
-- Name: users users_email_key210; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key210 UNIQUE (email);


--
-- Name: users users_email_key211; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key211 UNIQUE (email);


--
-- Name: users users_email_key212; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key212 UNIQUE (email);


--
-- Name: users users_email_key213; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key213 UNIQUE (email);


--
-- Name: users users_email_key214; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key214 UNIQUE (email);


--
-- Name: users users_email_key215; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key215 UNIQUE (email);


--
-- Name: users users_email_key216; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key216 UNIQUE (email);


--
-- Name: users users_email_key217; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key217 UNIQUE (email);


--
-- Name: users users_email_key218; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key218 UNIQUE (email);


--
-- Name: users users_email_key219; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key219 UNIQUE (email);


--
-- Name: users users_email_key22; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key22 UNIQUE (email);


--
-- Name: users users_email_key220; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key220 UNIQUE (email);


--
-- Name: users users_email_key221; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key221 UNIQUE (email);


--
-- Name: users users_email_key222; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key222 UNIQUE (email);


--
-- Name: users users_email_key223; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key223 UNIQUE (email);


--
-- Name: users users_email_key224; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key224 UNIQUE (email);


--
-- Name: users users_email_key225; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key225 UNIQUE (email);


--
-- Name: users users_email_key226; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key226 UNIQUE (email);


--
-- Name: users users_email_key227; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key227 UNIQUE (email);


--
-- Name: users users_email_key228; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key228 UNIQUE (email);


--
-- Name: users users_email_key229; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key229 UNIQUE (email);


--
-- Name: users users_email_key23; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key23 UNIQUE (email);


--
-- Name: users users_email_key230; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key230 UNIQUE (email);


--
-- Name: users users_email_key231; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key231 UNIQUE (email);


--
-- Name: users users_email_key232; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key232 UNIQUE (email);


--
-- Name: users users_email_key233; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key233 UNIQUE (email);


--
-- Name: users users_email_key234; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key234 UNIQUE (email);


--
-- Name: users users_email_key235; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key235 UNIQUE (email);


--
-- Name: users users_email_key236; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key236 UNIQUE (email);


--
-- Name: users users_email_key237; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key237 UNIQUE (email);


--
-- Name: users users_email_key238; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key238 UNIQUE (email);


--
-- Name: users users_email_key239; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key239 UNIQUE (email);


--
-- Name: users users_email_key24; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key24 UNIQUE (email);


--
-- Name: users users_email_key240; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key240 UNIQUE (email);


--
-- Name: users users_email_key241; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key241 UNIQUE (email);


--
-- Name: users users_email_key242; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key242 UNIQUE (email);


--
-- Name: users users_email_key243; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key243 UNIQUE (email);


--
-- Name: users users_email_key244; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key244 UNIQUE (email);


--
-- Name: users users_email_key245; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key245 UNIQUE (email);


--
-- Name: users users_email_key246; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key246 UNIQUE (email);


--
-- Name: users users_email_key247; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key247 UNIQUE (email);


--
-- Name: users users_email_key248; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key248 UNIQUE (email);


--
-- Name: users users_email_key249; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key249 UNIQUE (email);


--
-- Name: users users_email_key25; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key25 UNIQUE (email);


--
-- Name: users users_email_key250; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key250 UNIQUE (email);


--
-- Name: users users_email_key251; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key251 UNIQUE (email);


--
-- Name: users users_email_key252; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key252 UNIQUE (email);


--
-- Name: users users_email_key253; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key253 UNIQUE (email);


--
-- Name: users users_email_key254; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key254 UNIQUE (email);


--
-- Name: users users_email_key255; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key255 UNIQUE (email);


--
-- Name: users users_email_key256; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key256 UNIQUE (email);


--
-- Name: users users_email_key257; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key257 UNIQUE (email);


--
-- Name: users users_email_key258; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key258 UNIQUE (email);


--
-- Name: users users_email_key259; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key259 UNIQUE (email);


--
-- Name: users users_email_key26; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key26 UNIQUE (email);


--
-- Name: users users_email_key260; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key260 UNIQUE (email);


--
-- Name: users users_email_key261; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key261 UNIQUE (email);


--
-- Name: users users_email_key262; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key262 UNIQUE (email);


--
-- Name: users users_email_key263; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key263 UNIQUE (email);


--
-- Name: users users_email_key264; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key264 UNIQUE (email);


--
-- Name: users users_email_key265; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key265 UNIQUE (email);


--
-- Name: users users_email_key266; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key266 UNIQUE (email);


--
-- Name: users users_email_key267; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key267 UNIQUE (email);


--
-- Name: users users_email_key268; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key268 UNIQUE (email);


--
-- Name: users users_email_key269; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key269 UNIQUE (email);


--
-- Name: users users_email_key27; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key27 UNIQUE (email);


--
-- Name: users users_email_key270; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key270 UNIQUE (email);


--
-- Name: users users_email_key271; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key271 UNIQUE (email);


--
-- Name: users users_email_key272; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key272 UNIQUE (email);


--
-- Name: users users_email_key273; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key273 UNIQUE (email);


--
-- Name: users users_email_key274; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key274 UNIQUE (email);


--
-- Name: users users_email_key28; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key28 UNIQUE (email);


--
-- Name: users users_email_key29; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key29 UNIQUE (email);


--
-- Name: users users_email_key3; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key3 UNIQUE (email);


--
-- Name: users users_email_key30; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key30 UNIQUE (email);


--
-- Name: users users_email_key31; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key31 UNIQUE (email);


--
-- Name: users users_email_key32; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key32 UNIQUE (email);


--
-- Name: users users_email_key33; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key33 UNIQUE (email);


--
-- Name: users users_email_key34; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key34 UNIQUE (email);


--
-- Name: users users_email_key35; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key35 UNIQUE (email);


--
-- Name: users users_email_key36; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key36 UNIQUE (email);


--
-- Name: users users_email_key37; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key37 UNIQUE (email);


--
-- Name: users users_email_key38; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key38 UNIQUE (email);


--
-- Name: users users_email_key39; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key39 UNIQUE (email);


--
-- Name: users users_email_key4; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key4 UNIQUE (email);


--
-- Name: users users_email_key40; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key40 UNIQUE (email);


--
-- Name: users users_email_key41; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key41 UNIQUE (email);


--
-- Name: users users_email_key42; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key42 UNIQUE (email);


--
-- Name: users users_email_key43; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key43 UNIQUE (email);


--
-- Name: users users_email_key44; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key44 UNIQUE (email);


--
-- Name: users users_email_key45; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key45 UNIQUE (email);


--
-- Name: users users_email_key46; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key46 UNIQUE (email);


--
-- Name: users users_email_key47; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key47 UNIQUE (email);


--
-- Name: users users_email_key48; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key48 UNIQUE (email);


--
-- Name: users users_email_key49; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key49 UNIQUE (email);


--
-- Name: users users_email_key5; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key5 UNIQUE (email);


--
-- Name: users users_email_key50; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key50 UNIQUE (email);


--
-- Name: users users_email_key51; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key51 UNIQUE (email);


--
-- Name: users users_email_key52; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key52 UNIQUE (email);


--
-- Name: users users_email_key53; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key53 UNIQUE (email);


--
-- Name: users users_email_key54; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key54 UNIQUE (email);


--
-- Name: users users_email_key55; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key55 UNIQUE (email);


--
-- Name: users users_email_key56; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key56 UNIQUE (email);


--
-- Name: users users_email_key57; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key57 UNIQUE (email);


--
-- Name: users users_email_key58; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key58 UNIQUE (email);


--
-- Name: users users_email_key59; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key59 UNIQUE (email);


--
-- Name: users users_email_key6; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key6 UNIQUE (email);


--
-- Name: users users_email_key60; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key60 UNIQUE (email);


--
-- Name: users users_email_key61; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key61 UNIQUE (email);


--
-- Name: users users_email_key62; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key62 UNIQUE (email);


--
-- Name: users users_email_key63; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key63 UNIQUE (email);


--
-- Name: users users_email_key64; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key64 UNIQUE (email);


--
-- Name: users users_email_key65; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key65 UNIQUE (email);


--
-- Name: users users_email_key66; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key66 UNIQUE (email);


--
-- Name: users users_email_key67; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key67 UNIQUE (email);


--
-- Name: users users_email_key68; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key68 UNIQUE (email);


--
-- Name: users users_email_key69; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key69 UNIQUE (email);


--
-- Name: users users_email_key7; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key7 UNIQUE (email);


--
-- Name: users users_email_key70; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key70 UNIQUE (email);


--
-- Name: users users_email_key71; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key71 UNIQUE (email);


--
-- Name: users users_email_key72; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key72 UNIQUE (email);


--
-- Name: users users_email_key73; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key73 UNIQUE (email);


--
-- Name: users users_email_key74; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key74 UNIQUE (email);


--
-- Name: users users_email_key75; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key75 UNIQUE (email);


--
-- Name: users users_email_key76; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key76 UNIQUE (email);


--
-- Name: users users_email_key77; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key77 UNIQUE (email);


--
-- Name: users users_email_key78; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key78 UNIQUE (email);


--
-- Name: users users_email_key79; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key79 UNIQUE (email);


--
-- Name: users users_email_key8; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key8 UNIQUE (email);


--
-- Name: users users_email_key80; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key80 UNIQUE (email);


--
-- Name: users users_email_key81; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key81 UNIQUE (email);


--
-- Name: users users_email_key82; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key82 UNIQUE (email);


--
-- Name: users users_email_key83; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key83 UNIQUE (email);


--
-- Name: users users_email_key84; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key84 UNIQUE (email);


--
-- Name: users users_email_key85; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key85 UNIQUE (email);


--
-- Name: users users_email_key86; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key86 UNIQUE (email);


--
-- Name: users users_email_key87; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key87 UNIQUE (email);


--
-- Name: users users_email_key88; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key88 UNIQUE (email);


--
-- Name: users users_email_key89; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key89 UNIQUE (email);


--
-- Name: users users_email_key9; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key9 UNIQUE (email);


--
-- Name: users users_email_key90; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key90 UNIQUE (email);


--
-- Name: users users_email_key91; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key91 UNIQUE (email);


--
-- Name: users users_email_key92; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key92 UNIQUE (email);


--
-- Name: users users_email_key93; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key93 UNIQUE (email);


--
-- Name: users users_email_key94; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key94 UNIQUE (email);


--
-- Name: users users_email_key95; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key95 UNIQUE (email);


--
-- Name: users users_email_key96; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key96 UNIQUE (email);


--
-- Name: users users_email_key97; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key97 UNIQUE (email);


--
-- Name: users users_email_key98; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key98 UNIQUE (email);


--
-- Name: users users_email_key99; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key99 UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: users users_username_key1; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key1 UNIQUE (username);


--
-- Name: users users_username_key10; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key10 UNIQUE (username);


--
-- Name: users users_username_key100; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key100 UNIQUE (username);


--
-- Name: users users_username_key101; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key101 UNIQUE (username);


--
-- Name: users users_username_key102; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key102 UNIQUE (username);


--
-- Name: users users_username_key103; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key103 UNIQUE (username);


--
-- Name: users users_username_key104; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key104 UNIQUE (username);


--
-- Name: users users_username_key105; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key105 UNIQUE (username);


--
-- Name: users users_username_key106; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key106 UNIQUE (username);


--
-- Name: users users_username_key107; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key107 UNIQUE (username);


--
-- Name: users users_username_key108; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key108 UNIQUE (username);


--
-- Name: users users_username_key109; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key109 UNIQUE (username);


--
-- Name: users users_username_key11; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key11 UNIQUE (username);


--
-- Name: users users_username_key110; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key110 UNIQUE (username);


--
-- Name: users users_username_key111; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key111 UNIQUE (username);


--
-- Name: users users_username_key112; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key112 UNIQUE (username);


--
-- Name: users users_username_key113; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key113 UNIQUE (username);


--
-- Name: users users_username_key114; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key114 UNIQUE (username);


--
-- Name: users users_username_key115; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key115 UNIQUE (username);


--
-- Name: users users_username_key116; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key116 UNIQUE (username);


--
-- Name: users users_username_key117; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key117 UNIQUE (username);


--
-- Name: users users_username_key118; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key118 UNIQUE (username);


--
-- Name: users users_username_key119; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key119 UNIQUE (username);


--
-- Name: users users_username_key12; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key12 UNIQUE (username);


--
-- Name: users users_username_key120; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key120 UNIQUE (username);


--
-- Name: users users_username_key121; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key121 UNIQUE (username);


--
-- Name: users users_username_key122; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key122 UNIQUE (username);


--
-- Name: users users_username_key123; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key123 UNIQUE (username);


--
-- Name: users users_username_key124; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key124 UNIQUE (username);


--
-- Name: users users_username_key125; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key125 UNIQUE (username);


--
-- Name: users users_username_key126; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key126 UNIQUE (username);


--
-- Name: users users_username_key127; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key127 UNIQUE (username);


--
-- Name: users users_username_key128; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key128 UNIQUE (username);


--
-- Name: users users_username_key129; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key129 UNIQUE (username);


--
-- Name: users users_username_key13; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key13 UNIQUE (username);


--
-- Name: users users_username_key130; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key130 UNIQUE (username);


--
-- Name: users users_username_key131; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key131 UNIQUE (username);


--
-- Name: users users_username_key132; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key132 UNIQUE (username);


--
-- Name: users users_username_key133; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key133 UNIQUE (username);


--
-- Name: users users_username_key134; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key134 UNIQUE (username);


--
-- Name: users users_username_key135; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key135 UNIQUE (username);


--
-- Name: users users_username_key136; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key136 UNIQUE (username);


--
-- Name: users users_username_key137; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key137 UNIQUE (username);


--
-- Name: users users_username_key138; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key138 UNIQUE (username);


--
-- Name: users users_username_key139; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key139 UNIQUE (username);


--
-- Name: users users_username_key14; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key14 UNIQUE (username);


--
-- Name: users users_username_key140; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key140 UNIQUE (username);


--
-- Name: users users_username_key141; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key141 UNIQUE (username);


--
-- Name: users users_username_key142; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key142 UNIQUE (username);


--
-- Name: users users_username_key143; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key143 UNIQUE (username);


--
-- Name: users users_username_key144; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key144 UNIQUE (username);


--
-- Name: users users_username_key145; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key145 UNIQUE (username);


--
-- Name: users users_username_key146; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key146 UNIQUE (username);


--
-- Name: users users_username_key147; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key147 UNIQUE (username);


--
-- Name: users users_username_key148; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key148 UNIQUE (username);


--
-- Name: users users_username_key149; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key149 UNIQUE (username);


--
-- Name: users users_username_key15; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key15 UNIQUE (username);


--
-- Name: users users_username_key150; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key150 UNIQUE (username);


--
-- Name: users users_username_key151; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key151 UNIQUE (username);


--
-- Name: users users_username_key152; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key152 UNIQUE (username);


--
-- Name: users users_username_key153; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key153 UNIQUE (username);


--
-- Name: users users_username_key154; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key154 UNIQUE (username);


--
-- Name: users users_username_key155; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key155 UNIQUE (username);


--
-- Name: users users_username_key156; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key156 UNIQUE (username);


--
-- Name: users users_username_key157; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key157 UNIQUE (username);


--
-- Name: users users_username_key158; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key158 UNIQUE (username);


--
-- Name: users users_username_key159; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key159 UNIQUE (username);


--
-- Name: users users_username_key16; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key16 UNIQUE (username);


--
-- Name: users users_username_key160; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key160 UNIQUE (username);


--
-- Name: users users_username_key161; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key161 UNIQUE (username);


--
-- Name: users users_username_key162; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key162 UNIQUE (username);


--
-- Name: users users_username_key163; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key163 UNIQUE (username);


--
-- Name: users users_username_key164; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key164 UNIQUE (username);


--
-- Name: users users_username_key165; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key165 UNIQUE (username);


--
-- Name: users users_username_key166; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key166 UNIQUE (username);


--
-- Name: users users_username_key167; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key167 UNIQUE (username);


--
-- Name: users users_username_key168; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key168 UNIQUE (username);


--
-- Name: users users_username_key169; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key169 UNIQUE (username);


--
-- Name: users users_username_key17; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key17 UNIQUE (username);


--
-- Name: users users_username_key170; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key170 UNIQUE (username);


--
-- Name: users users_username_key171; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key171 UNIQUE (username);


--
-- Name: users users_username_key172; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key172 UNIQUE (username);


--
-- Name: users users_username_key173; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key173 UNIQUE (username);


--
-- Name: users users_username_key174; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key174 UNIQUE (username);


--
-- Name: users users_username_key175; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key175 UNIQUE (username);


--
-- Name: users users_username_key176; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key176 UNIQUE (username);


--
-- Name: users users_username_key177; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key177 UNIQUE (username);


--
-- Name: users users_username_key178; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key178 UNIQUE (username);


--
-- Name: users users_username_key179; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key179 UNIQUE (username);


--
-- Name: users users_username_key18; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key18 UNIQUE (username);


--
-- Name: users users_username_key180; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key180 UNIQUE (username);


--
-- Name: users users_username_key181; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key181 UNIQUE (username);


--
-- Name: users users_username_key182; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key182 UNIQUE (username);


--
-- Name: users users_username_key183; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key183 UNIQUE (username);


--
-- Name: users users_username_key184; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key184 UNIQUE (username);


--
-- Name: users users_username_key185; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key185 UNIQUE (username);


--
-- Name: users users_username_key186; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key186 UNIQUE (username);


--
-- Name: users users_username_key187; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key187 UNIQUE (username);


--
-- Name: users users_username_key188; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key188 UNIQUE (username);


--
-- Name: users users_username_key189; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key189 UNIQUE (username);


--
-- Name: users users_username_key19; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key19 UNIQUE (username);


--
-- Name: users users_username_key190; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key190 UNIQUE (username);


--
-- Name: users users_username_key191; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key191 UNIQUE (username);


--
-- Name: users users_username_key192; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key192 UNIQUE (username);


--
-- Name: users users_username_key193; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key193 UNIQUE (username);


--
-- Name: users users_username_key194; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key194 UNIQUE (username);


--
-- Name: users users_username_key195; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key195 UNIQUE (username);


--
-- Name: users users_username_key196; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key196 UNIQUE (username);


--
-- Name: users users_username_key197; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key197 UNIQUE (username);


--
-- Name: users users_username_key198; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key198 UNIQUE (username);


--
-- Name: users users_username_key199; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key199 UNIQUE (username);


--
-- Name: users users_username_key2; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key2 UNIQUE (username);


--
-- Name: users users_username_key20; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key20 UNIQUE (username);


--
-- Name: users users_username_key200; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key200 UNIQUE (username);


--
-- Name: users users_username_key201; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key201 UNIQUE (username);


--
-- Name: users users_username_key202; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key202 UNIQUE (username);


--
-- Name: users users_username_key203; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key203 UNIQUE (username);


--
-- Name: users users_username_key204; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key204 UNIQUE (username);


--
-- Name: users users_username_key205; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key205 UNIQUE (username);


--
-- Name: users users_username_key206; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key206 UNIQUE (username);


--
-- Name: users users_username_key207; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key207 UNIQUE (username);


--
-- Name: users users_username_key208; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key208 UNIQUE (username);


--
-- Name: users users_username_key209; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key209 UNIQUE (username);


--
-- Name: users users_username_key21; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key21 UNIQUE (username);


--
-- Name: users users_username_key210; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key210 UNIQUE (username);


--
-- Name: users users_username_key211; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key211 UNIQUE (username);


--
-- Name: users users_username_key212; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key212 UNIQUE (username);


--
-- Name: users users_username_key213; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key213 UNIQUE (username);


--
-- Name: users users_username_key214; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key214 UNIQUE (username);


--
-- Name: users users_username_key215; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key215 UNIQUE (username);


--
-- Name: users users_username_key216; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key216 UNIQUE (username);


--
-- Name: users users_username_key217; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key217 UNIQUE (username);


--
-- Name: users users_username_key218; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key218 UNIQUE (username);


--
-- Name: users users_username_key219; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key219 UNIQUE (username);


--
-- Name: users users_username_key22; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key22 UNIQUE (username);


--
-- Name: users users_username_key220; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key220 UNIQUE (username);


--
-- Name: users users_username_key221; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key221 UNIQUE (username);


--
-- Name: users users_username_key222; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key222 UNIQUE (username);


--
-- Name: users users_username_key223; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key223 UNIQUE (username);


--
-- Name: users users_username_key224; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key224 UNIQUE (username);


--
-- Name: users users_username_key225; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key225 UNIQUE (username);


--
-- Name: users users_username_key226; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key226 UNIQUE (username);


--
-- Name: users users_username_key227; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key227 UNIQUE (username);


--
-- Name: users users_username_key228; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key228 UNIQUE (username);


--
-- Name: users users_username_key229; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key229 UNIQUE (username);


--
-- Name: users users_username_key23; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key23 UNIQUE (username);


--
-- Name: users users_username_key230; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key230 UNIQUE (username);


--
-- Name: users users_username_key231; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key231 UNIQUE (username);


--
-- Name: users users_username_key232; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key232 UNIQUE (username);


--
-- Name: users users_username_key233; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key233 UNIQUE (username);


--
-- Name: users users_username_key234; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key234 UNIQUE (username);


--
-- Name: users users_username_key235; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key235 UNIQUE (username);


--
-- Name: users users_username_key236; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key236 UNIQUE (username);


--
-- Name: users users_username_key237; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key237 UNIQUE (username);


--
-- Name: users users_username_key238; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key238 UNIQUE (username);


--
-- Name: users users_username_key239; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key239 UNIQUE (username);


--
-- Name: users users_username_key24; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key24 UNIQUE (username);


--
-- Name: users users_username_key240; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key240 UNIQUE (username);


--
-- Name: users users_username_key241; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key241 UNIQUE (username);


--
-- Name: users users_username_key242; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key242 UNIQUE (username);


--
-- Name: users users_username_key243; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key243 UNIQUE (username);


--
-- Name: users users_username_key244; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key244 UNIQUE (username);


--
-- Name: users users_username_key245; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key245 UNIQUE (username);


--
-- Name: users users_username_key246; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key246 UNIQUE (username);


--
-- Name: users users_username_key247; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key247 UNIQUE (username);


--
-- Name: users users_username_key248; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key248 UNIQUE (username);


--
-- Name: users users_username_key249; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key249 UNIQUE (username);


--
-- Name: users users_username_key25; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key25 UNIQUE (username);


--
-- Name: users users_username_key250; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key250 UNIQUE (username);


--
-- Name: users users_username_key251; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key251 UNIQUE (username);


--
-- Name: users users_username_key252; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key252 UNIQUE (username);


--
-- Name: users users_username_key253; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key253 UNIQUE (username);


--
-- Name: users users_username_key254; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key254 UNIQUE (username);


--
-- Name: users users_username_key255; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key255 UNIQUE (username);


--
-- Name: users users_username_key256; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key256 UNIQUE (username);


--
-- Name: users users_username_key257; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key257 UNIQUE (username);


--
-- Name: users users_username_key258; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key258 UNIQUE (username);


--
-- Name: users users_username_key259; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key259 UNIQUE (username);


--
-- Name: users users_username_key26; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key26 UNIQUE (username);


--
-- Name: users users_username_key260; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key260 UNIQUE (username);


--
-- Name: users users_username_key261; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key261 UNIQUE (username);


--
-- Name: users users_username_key262; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key262 UNIQUE (username);


--
-- Name: users users_username_key263; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key263 UNIQUE (username);


--
-- Name: users users_username_key264; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key264 UNIQUE (username);


--
-- Name: users users_username_key265; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key265 UNIQUE (username);


--
-- Name: users users_username_key266; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key266 UNIQUE (username);


--
-- Name: users users_username_key267; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key267 UNIQUE (username);


--
-- Name: users users_username_key268; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key268 UNIQUE (username);


--
-- Name: users users_username_key269; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key269 UNIQUE (username);


--
-- Name: users users_username_key27; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key27 UNIQUE (username);


--
-- Name: users users_username_key270; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key270 UNIQUE (username);


--
-- Name: users users_username_key271; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key271 UNIQUE (username);


--
-- Name: users users_username_key272; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key272 UNIQUE (username);


--
-- Name: users users_username_key273; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key273 UNIQUE (username);


--
-- Name: users users_username_key274; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key274 UNIQUE (username);


--
-- Name: users users_username_key275; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key275 UNIQUE (username);


--
-- Name: users users_username_key276; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key276 UNIQUE (username);


--
-- Name: users users_username_key28; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key28 UNIQUE (username);


--
-- Name: users users_username_key29; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key29 UNIQUE (username);


--
-- Name: users users_username_key3; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key3 UNIQUE (username);


--
-- Name: users users_username_key30; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key30 UNIQUE (username);


--
-- Name: users users_username_key31; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key31 UNIQUE (username);


--
-- Name: users users_username_key32; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key32 UNIQUE (username);


--
-- Name: users users_username_key33; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key33 UNIQUE (username);


--
-- Name: users users_username_key34; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key34 UNIQUE (username);


--
-- Name: users users_username_key35; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key35 UNIQUE (username);


--
-- Name: users users_username_key36; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key36 UNIQUE (username);


--
-- Name: users users_username_key37; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key37 UNIQUE (username);


--
-- Name: users users_username_key38; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key38 UNIQUE (username);


--
-- Name: users users_username_key39; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key39 UNIQUE (username);


--
-- Name: users users_username_key4; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key4 UNIQUE (username);


--
-- Name: users users_username_key40; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key40 UNIQUE (username);


--
-- Name: users users_username_key41; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key41 UNIQUE (username);


--
-- Name: users users_username_key42; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key42 UNIQUE (username);


--
-- Name: users users_username_key43; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key43 UNIQUE (username);


--
-- Name: users users_username_key44; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key44 UNIQUE (username);


--
-- Name: users users_username_key45; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key45 UNIQUE (username);


--
-- Name: users users_username_key46; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key46 UNIQUE (username);


--
-- Name: users users_username_key47; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key47 UNIQUE (username);


--
-- Name: users users_username_key48; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key48 UNIQUE (username);


--
-- Name: users users_username_key49; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key49 UNIQUE (username);


--
-- Name: users users_username_key5; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key5 UNIQUE (username);


--
-- Name: users users_username_key50; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key50 UNIQUE (username);


--
-- Name: users users_username_key51; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key51 UNIQUE (username);


--
-- Name: users users_username_key52; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key52 UNIQUE (username);


--
-- Name: users users_username_key53; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key53 UNIQUE (username);


--
-- Name: users users_username_key54; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key54 UNIQUE (username);


--
-- Name: users users_username_key55; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key55 UNIQUE (username);


--
-- Name: users users_username_key56; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key56 UNIQUE (username);


--
-- Name: users users_username_key57; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key57 UNIQUE (username);


--
-- Name: users users_username_key58; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key58 UNIQUE (username);


--
-- Name: users users_username_key59; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key59 UNIQUE (username);


--
-- Name: users users_username_key6; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key6 UNIQUE (username);


--
-- Name: users users_username_key60; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key60 UNIQUE (username);


--
-- Name: users users_username_key61; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key61 UNIQUE (username);


--
-- Name: users users_username_key62; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key62 UNIQUE (username);


--
-- Name: users users_username_key63; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key63 UNIQUE (username);


--
-- Name: users users_username_key64; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key64 UNIQUE (username);


--
-- Name: users users_username_key65; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key65 UNIQUE (username);


--
-- Name: users users_username_key66; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key66 UNIQUE (username);


--
-- Name: users users_username_key67; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key67 UNIQUE (username);


--
-- Name: users users_username_key68; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key68 UNIQUE (username);


--
-- Name: users users_username_key69; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key69 UNIQUE (username);


--
-- Name: users users_username_key7; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key7 UNIQUE (username);


--
-- Name: users users_username_key70; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key70 UNIQUE (username);


--
-- Name: users users_username_key71; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key71 UNIQUE (username);


--
-- Name: users users_username_key72; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key72 UNIQUE (username);


--
-- Name: users users_username_key73; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key73 UNIQUE (username);


--
-- Name: users users_username_key74; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key74 UNIQUE (username);


--
-- Name: users users_username_key75; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key75 UNIQUE (username);


--
-- Name: users users_username_key76; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key76 UNIQUE (username);


--
-- Name: users users_username_key77; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key77 UNIQUE (username);


--
-- Name: users users_username_key78; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key78 UNIQUE (username);


--
-- Name: users users_username_key79; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key79 UNIQUE (username);


--
-- Name: users users_username_key8; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key8 UNIQUE (username);


--
-- Name: users users_username_key80; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key80 UNIQUE (username);


--
-- Name: users users_username_key81; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key81 UNIQUE (username);


--
-- Name: users users_username_key82; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key82 UNIQUE (username);


--
-- Name: users users_username_key83; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key83 UNIQUE (username);


--
-- Name: users users_username_key84; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key84 UNIQUE (username);


--
-- Name: users users_username_key85; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key85 UNIQUE (username);


--
-- Name: users users_username_key86; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key86 UNIQUE (username);


--
-- Name: users users_username_key87; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key87 UNIQUE (username);


--
-- Name: users users_username_key88; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key88 UNIQUE (username);


--
-- Name: users users_username_key89; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key89 UNIQUE (username);


--
-- Name: users users_username_key9; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key9 UNIQUE (username);


--
-- Name: users users_username_key90; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key90 UNIQUE (username);


--
-- Name: users users_username_key91; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key91 UNIQUE (username);


--
-- Name: users users_username_key92; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key92 UNIQUE (username);


--
-- Name: users users_username_key93; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key93 UNIQUE (username);


--
-- Name: users users_username_key94; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key94 UNIQUE (username);


--
-- Name: users users_username_key95; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key95 UNIQUE (username);


--
-- Name: users users_username_key96; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key96 UNIQUE (username);


--
-- Name: users users_username_key97; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key97 UNIQUE (username);


--
-- Name: users users_username_key98; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key98 UNIQUE (username);


--
-- Name: users users_username_key99; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key99 UNIQUE (username);


--
-- Name: views views_pkey; Type: CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.views
    ADD CONSTRAINT views_pkey PRIMARY KEY (id);


--
-- Name: idx_admins_status; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_admins_status ON public.admins USING btree (status);


--
-- Name: idx_approvers_status; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_approvers_status ON public.approvers USING btree (status);


--
-- Name: idx_follows_follower; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_follows_follower ON public.follows USING btree ("followerId");


--
-- Name: idx_follows_following; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_follows_following ON public.follows USING btree ("followingId");


--
-- Name: idx_posts_admin_id; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_posts_admin_id ON public.posts USING btree (admin_id);


--
-- Name: idx_posts_approver_id; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_posts_approver_id ON public.posts USING btree (approver_id);


--
-- Name: idx_posts_status; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_posts_status ON public.posts USING btree (status);


--
-- Name: idx_posts_user_id; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_posts_user_id ON public.posts USING btree (user_id);


--
-- Name: idx_users_follower_count; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_users_follower_count ON public.users USING btree (follower_count);


--
-- Name: idx_users_last_active; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_users_last_active ON public.users USING btree (last_active_date);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: talynk_k5dt_user
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: account_management account_management_accountID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.account_management
    ADD CONSTRAINT "account_management_accountID_fkey" FOREIGN KEY ("accountID") REFERENCES public.users(username) ON UPDATE CASCADE;


--
-- Name: ads ads_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT "ads_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: approvers approvers_registeredBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.approvers
    ADD CONSTRAINT "approvers_registeredBy_fkey" FOREIGN KEY ("registeredBy") REFERENCES public.admins(username);


--
-- Name: approvers approvers_registered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.approvers
    ADD CONSTRAINT approvers_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.admins(id);


--
-- Name: comments comments_commentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_commentor_id_fkey FOREIGN KEY (commentor_id) REFERENCES public.users(id);


--
-- Name: follows follows_followerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES public.users(id);


--
-- Name: follows follows_followingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES public.users(id);


--
-- Name: userid notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.userid
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(username);


--
-- Name: notifications notifications_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id);


--
-- Name: post_likes post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- Name: posts posts_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.approvers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: posts posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: recent_searches recent_searches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.recent_searches
    ADD CONSTRAINT recent_searches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(username);


--
-- Name: shares shares_postId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT "shares_postId_fkey" FOREIGN KEY ("postId") REFERENCES public.posts(id);


--
-- Name: shares shares_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT "shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: subscriptions subscriptions_subscribed_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subscribed_to_fkey FOREIGN KEY (subscribed_to) REFERENCES public.users(id);


--
-- Name: subscriptions subscriptions_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.users(id);


--
-- Name: views views_postId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.views
    ADD CONSTRAINT "views_postId_fkey" FOREIGN KEY ("postId") REFERENCES public.posts(id);


--
-- Name: views views_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talynk_k5dt_user
--

ALTER TABLE ONLY public.views
    ADD CONSTRAINT "views_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_generate_v1() TO talynk_k5dt_user;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_generate_v1mc() TO talynk_k5dt_user;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_generate_v3(namespace uuid, name text) TO talynk_k5dt_user;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_generate_v4() TO talynk_k5dt_user;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_generate_v5(namespace uuid, name text) TO talynk_k5dt_user;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_nil() TO talynk_k5dt_user;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_ns_dns() TO talynk_k5dt_user;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_ns_oid() TO talynk_k5dt_user;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_ns_url() TO talynk_k5dt_user;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.uuid_ns_x500() TO talynk_k5dt_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO talynk_k5dt_user;


--
-- Name: DEFAULT PRIVILEGES FOR TYPES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO talynk_k5dt_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO talynk_k5dt_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO talynk_k5dt_user;


--
-- PostgreSQL database dump complete
--

