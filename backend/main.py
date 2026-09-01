from urllib import response

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Query, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse

from supabase_client import supabase
from pydantic import BaseModel
from google import genai

import json
import os
import time
import re
import logging
from datetime import datetime, timezone


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-job-board")

app = FastAPI(title="AI Job Board API")

FILTER_OPTIONS_CACHE = None

LOCATION_COUNTRIES_STATIC = [{'code': 'AF', 'name': 'Afghanistan', 'emoji': ''}, {'code': 'AL', 'name': 'Albania', 'emoji': ''}, {'code': 'DZ', 'name': 'Algeria', 'emoji': ''}, {'code': 'AS', 'name': 'American Samoa', 'emoji': ''}, {'code': 'AD', 'name': 'Andorra', 'emoji': ''}, {'code': 'AO', 'name': 'Angola', 'emoji': ''}, {'code': 'AI', 'name': 'Anguilla', 'emoji': ''}, {'code': 'AQ', 'name': 'Antarctica', 'emoji': ''}, {'code': 'AG', 'name': 'Antigua and Barbuda', 'emoji': ''}, {'code': 'AR', 'name': 'Argentina', 'emoji': ''}, {'code': 'AM', 'name': 'Armenia', 'emoji': ''}, {'code': 'AW', 'name': 'Aruba', 'emoji': ''}, {'code': 'AU', 'name': 'Australia', 'emoji': ''}, {'code': 'AT', 'name': 'Austria', 'emoji': ''}, {'code': 'AZ', 'name': 'Azerbaijan', 'emoji': ''}, {'code': 'BS', 'name': 'Bahamas', 'emoji': ''}, {'code': 'BH', 'name': 'Bahrain', 'emoji': ''}, {'code': 'BD', 'name': 'Bangladesh', 'emoji': ''}, {'code': 'BB', 'name': 'Barbados', 'emoji': ''}, {'code': 'BY', 'name': 'Belarus', 'emoji': ''}, {'code': 'BE', 'name': 'Belgium', 'emoji': ''}, {'code': 'BZ', 'name': 'Belize', 'emoji': ''}, {'code': 'BJ', 'name': 'Benin', 'emoji': ''}, {'code': 'BM', 'name': 'Bermuda', 'emoji': ''}, {'code': 'BT', 'name': 'Bhutan', 'emoji': ''}, {'code': 'BO', 'name': 'Bolivia, Plurinational State of', 'emoji': ''}, {'code': 'BQ', 'name': 'Bonaire, Sint Eustatius and Saba', 'emoji': ''}, {'code': 'BA', 'name': 'Bosnia and Herzegovina', 'emoji': ''}, {'code': 'BW', 'name': 'Botswana', 'emoji': ''}, {'code': 'BV', 'name': 'Bouvet Island', 'emoji': ''}, {'code': 'BR', 'name': 'Brazil', 'emoji': ''}, {'code': 'IO', 'name': 'British Indian Ocean Territory', 'emoji': ''}, {'code': 'BN', 'name': 'Brunei Darussalam', 'emoji': ''}, {'code': 'BG', 'name': 'Bulgaria', 'emoji': ''}, {'code': 'BF', 'name': 'Burkina Faso', 'emoji': ''}, {'code': 'BI', 'name': 'Burundi', 'emoji': ''}, {'code': 'CV', 'name': 'Cabo Verde', 'emoji': ''}, {'code': 'KH', 'name': 'Cambodia', 'emoji': ''}, {'code': 'CM', 'name': 'Cameroon', 'emoji': ''}, {'code': 'CA', 'name': 'Canada', 'emoji': ''}, {'code': 'KY', 'name': 'Cayman Islands', 'emoji': ''}, {'code': 'CF', 'name': 'Central African Republic', 'emoji': ''}, {'code': 'TD', 'name': 'Chad', 'emoji': ''}, {'code': 'CL', 'name': 'Chile', 'emoji': ''}, {'code': 'CN', 'name': 'China', 'emoji': ''}, {'code': 'CX', 'name': 'Christmas Island', 'emoji': ''}, {'code': 'CC', 'name': 'Cocos (Keeling) Islands', 'emoji': ''}, {'code': 'CO', 'name': 'Colombia', 'emoji': ''}, {'code': 'KM', 'name': 'Comoros', 'emoji': ''}, {'code': 'CG', 'name': 'Congo', 'emoji': ''}, {'code': 'CD', 'name': 'Congo, The Democratic Republic of the', 'emoji': ''}, {'code': 'CK', 'name': 'Cook Islands', 'emoji': ''}, {'code': 'CR', 'name': 'Costa Rica', 'emoji': ''}, {'code': 'HR', 'name': 'Croatia', 'emoji': ''}, {'code': 'CU', 'name': 'Cuba', 'emoji': ''}, {'code': 'CW', 'name': 'Curaçao', 'emoji': ''}, {'code': 'CY', 'name': 'Cyprus', 'emoji': ''}, {'code': 'CZ', 'name': 'Czechia', 'emoji': ''}, {'code': 'CI', 'name': "Côte d'Ivoire", 'emoji': ''}, {'code': 'DK', 'name': 'Denmark', 'emoji': ''}, {'code': 'DJ', 'name': 'Djibouti', 'emoji': ''}, {'code': 'DM', 'name': 'Dominica', 'emoji': ''}, {'code': 'DO', 'name': 'Dominican Republic', 'emoji': ''}, {'code': 'EC', 'name': 'Ecuador', 'emoji': ''}, {'code': 'EG', 'name': 'Egypt', 'emoji': ''}, {'code': 'SV', 'name': 'El Salvador', 'emoji': ''}, {'code': 'GQ', 'name': 'Equatorial Guinea', 'emoji': ''}, {'code': 'ER', 'name': 'Eritrea', 'emoji': ''}, {'code': 'EE', 'name': 'Estonia', 'emoji': ''}, {'code': 'SZ', 'name': 'Eswatini', 'emoji': ''}, {'code': 'ET', 'name': 'Ethiopia', 'emoji': ''}, {'code': 'FK', 'name': 'Falkland Islands (Malvinas)', 'emoji': ''}, {'code': 'FO', 'name': 'Faroe Islands', 'emoji': ''}, {'code': 'FJ', 'name': 'Fiji', 'emoji': ''}, {'code': 'FI', 'name': 'Finland', 'emoji': ''}, {'code': 'FR', 'name': 'France', 'emoji': ''}, {'code': 'GF', 'name': 'French Guiana', 'emoji': ''}, {'code': 'PF', 'name': 'French Polynesia', 'emoji': ''}, {'code': 'TF', 'name': 'French Southern Territories', 'emoji': ''}, {'code': 'GA', 'name': 'Gabon', 'emoji': ''}, {'code': 'GM', 'name': 'Gambia', 'emoji': ''}, {'code': 'GE', 'name': 'Georgia', 'emoji': ''}, {'code': 'DE', 'name': 'Germany', 'emoji': ''}, {'code': 'GH', 'name': 'Ghana', 'emoji': ''}, {'code': 'GI', 'name': 'Gibraltar', 'emoji': ''}, {'code': 'GR', 'name': 'Greece', 'emoji': ''}, {'code': 'GL', 'name': 'Greenland', 'emoji': ''}, {'code': 'GD', 'name': 'Grenada', 'emoji': ''}, {'code': 'GP', 'name': 'Guadeloupe', 'emoji': ''}, {'code': 'GU', 'name': 'Guam', 'emoji': ''}, {'code': 'GT', 'name': 'Guatemala', 'emoji': ''}, {'code': 'GG', 'name': 'Guernsey', 'emoji': ''}, {'code': 'GN', 'name': 'Guinea', 'emoji': ''}, {'code': 'GW', 'name': 'Guinea-Bissau', 'emoji': ''}, {'code': 'GY', 'name': 'Guyana', 'emoji': ''}, {'code': 'HT', 'name': 'Haiti', 'emoji': ''}, {'code': 'HM', 'name': 'Heard Island and McDonald Islands', 'emoji': ''}, {'code': 'VA', 'name': 'Holy See (Vatican City State)', 'emoji': ''}, {'code': 'HN', 'name': 'Honduras', 'emoji': ''}, {'code': 'HK', 'name': 'Hong Kong', 'emoji': ''}, {'code': 'HU', 'name': 'Hungary', 'emoji': ''}, {'code': 'IS', 'name': 'Iceland', 'emoji': ''}, {'code': 'IN', 'name': 'India', 'emoji': ''}, {'code': 'ID', 'name': 'Indonesia', 'emoji': ''}, {'code': 'IR', 'name': 'Iran, Islamic Republic of', 'emoji': ''}, {'code': 'IQ', 'name': 'Iraq', 'emoji': ''}, {'code': 'IE', 'name': 'Ireland', 'emoji': ''}, {'code': 'IM', 'name': 'Isle of Man', 'emoji': ''}, {'code': 'IL', 'name': 'Israel', 'emoji': ''}, {'code': 'IT', 'name': 'Italy', 'emoji': ''}, {'code': 'JM', 'name': 'Jamaica', 'emoji': ''}, {'code': 'JP', 'name': 'Japan', 'emoji': ''}, {'code': 'JE', 'name': 'Jersey', 'emoji': ''}, {'code': 'JO', 'name': 'Jordan', 'emoji': ''}, {'code': 'KZ', 'name': 'Kazakhstan', 'emoji': ''}, {'code': 'KE', 'name': 'Kenya', 'emoji': ''}, {'code': 'KI', 'name': 'Kiribati', 'emoji': ''}, {'code': 'KP', 'name': "Korea, Democratic People's Republic of", 'emoji': ''}, {'code': 'KR', 'name': 'Korea, Republic of', 'emoji': ''}, {'code': 'KW', 'name': 'Kuwait', 'emoji': ''}, {'code': 'KG', 'name': 'Kyrgyzstan', 'emoji': ''}, {'code': 'LA', 'name': "Lao People's Democratic Republic", 'emoji': ''}, {'code': 'LV', 'name': 'Latvia', 'emoji': ''}, {'code': 'LB', 'name': 'Lebanon', 'emoji': ''}, {'code': 'LS', 'name': 'Lesotho', 'emoji': ''}, {'code': 'LR', 'name': 'Liberia', 'emoji': ''}, {'code': 'LY', 'name': 'Libya', 'emoji': ''}, {'code': 'LI', 'name': 'Liechtenstein', 'emoji': ''}, {'code': 'LT', 'name': 'Lithuania', 'emoji': ''}, {'code': 'LU', 'name': 'Luxembourg', 'emoji': ''}, {'code': 'MO', 'name': 'Macao', 'emoji': ''}, {'code': 'MG', 'name': 'Madagascar', 'emoji': ''}, {'code': 'MW', 'name': 'Malawi', 'emoji': ''}, {'code': 'MY', 'name': 'Malaysia', 'emoji': ''}, {'code': 'MV', 'name': 'Maldives', 'emoji': ''}, {'code': 'ML', 'name': 'Mali', 'emoji': ''}, {'code': 'MT', 'name': 'Malta', 'emoji': ''}, {'code': 'MH', 'name': 'Marshall Islands', 'emoji': ''}, {'code': 'MQ', 'name': 'Martinique', 'emoji': ''}, {'code': 'MR', 'name': 'Mauritania', 'emoji': ''}, {'code': 'MU', 'name': 'Mauritius', 'emoji': ''}, {'code': 'YT', 'name': 'Mayotte', 'emoji': ''}, {'code': 'MX', 'name': 'Mexico', 'emoji': ''}, {'code': 'FM', 'name': 'Micronesia, Federated States of', 'emoji': ''}, {'code': 'MD', 'name': 'Moldova, Republic of', 'emoji': ''}, {'code': 'MC', 'name': 'Monaco', 'emoji': ''}, {'code': 'MN', 'name': 'Mongolia', 'emoji': ''}, {'code': 'ME', 'name': 'Montenegro', 'emoji': ''}, {'code': 'MS', 'name': 'Montserrat', 'emoji': ''}, {'code': 'MA', 'name': 'Morocco', 'emoji': ''}, {'code': 'MZ', 'name': 'Mozambique', 'emoji': ''}, {'code': 'MM', 'name': 'Myanmar', 'emoji': ''}, {'code': 'NA', 'name': 'Namibia', 'emoji': ''}, {'code': 'NR', 'name': 'Nauru', 'emoji': ''}, {'code': 'NP', 'name': 'Nepal', 'emoji': ''}, {'code': 'NL', 'name': 'Netherlands', 'emoji': ''}, {'code': 'NC', 'name': 'New Caledonia', 'emoji': ''}, {'code': 'NZ', 'name': 'New Zealand', 'emoji': ''}, {'code': 'NI', 'name': 'Nicaragua', 'emoji': ''}, {'code': 'NE', 'name': 'Niger', 'emoji': ''}, {'code': 'NG', 'name': 'Nigeria', 'emoji': ''}, {'code': 'NU', 'name': 'Niue', 'emoji': ''}, {'code': 'NF', 'name': 'Norfolk Island', 'emoji': ''}, {'code': 'MK', 'name': 'North Macedonia', 'emoji': ''}, {'code': 'MP', 'name': 'Northern Mariana Islands', 'emoji': ''}, {'code': 'NO', 'name': 'Norway', 'emoji': ''}, {'code': 'OM', 'name': 'Oman', 'emoji': ''}, {'code': 'PK', 'name': 'Pakistan', 'emoji': ''}, {'code': 'PW', 'name': 'Palau', 'emoji': ''}, {'code': 'PS', 'name': 'Palestine, State of', 'emoji': ''}, {'code': 'PA', 'name': 'Panama', 'emoji': ''}, {'code': 'PG', 'name': 'Papua New Guinea', 'emoji': ''}, {'code': 'PY', 'name': 'Paraguay', 'emoji': ''}, {'code': 'PE', 'name': 'Peru', 'emoji': ''}, {'code': 'PH', 'name': 'Philippines', 'emoji': ''}, {'code': 'PN', 'name': 'Pitcairn', 'emoji': ''}, {'code': 'PL', 'name': 'Poland', 'emoji': ''}, {'code': 'PT', 'name': 'Portugal', 'emoji': ''}, {'code': 'PR', 'name': 'Puerto Rico', 'emoji': ''}, {'code': 'QA', 'name': 'Qatar', 'emoji': ''}, {'code': 'RO', 'name': 'Romania', 'emoji': ''}, {'code': 'RU', 'name': 'Russian Federation', 'emoji': ''}, {'code': 'RW', 'name': 'Rwanda', 'emoji': ''}, {'code': 'RE', 'name': 'Réunion', 'emoji': ''}, {'code': 'BL', 'name': 'Saint Barthélemy', 'emoji': ''}, {'code': 'SH', 'name': 'Saint Helena, Ascension and Tristan da Cunha', 'emoji': ''}, {'code': 'KN', 'name': 'Saint Kitts and Nevis', 'emoji': ''}, {'code': 'LC', 'name': 'Saint Lucia', 'emoji': ''}, {'code': 'MF', 'name': 'Saint Martin (French part)', 'emoji': ''}, {'code': 'PM', 'name': 'Saint Pierre and Miquelon', 'emoji': ''}, {'code': 'VC', 'name': 'Saint Vincent and the Grenadines', 'emoji': ''}, {'code': 'WS', 'name': 'Samoa', 'emoji': ''}, {'code': 'SM', 'name': 'San Marino', 'emoji': ''}, {'code': 'ST', 'name': 'Sao Tome and Principe', 'emoji': ''}, {'code': 'SA', 'name': 'Saudi Arabia', 'emoji': ''}, {'code': 'SN', 'name': 'Senegal', 'emoji': ''}, {'code': 'RS', 'name': 'Serbia', 'emoji': ''}, {'code': 'SC', 'name': 'Seychelles', 'emoji': ''}, {'code': 'SL', 'name': 'Sierra Leone', 'emoji': ''}, {'code': 'SG', 'name': 'Singapore', 'emoji': ''}, {'code': 'SX', 'name': 'Sint Maarten (Dutch part)', 'emoji': ''}, {'code': 'SK', 'name': 'Slovakia', 'emoji': ''}, {'code': 'SI', 'name': 'Slovenia', 'emoji': ''}, {'code': 'SB', 'name': 'Solomon Islands', 'emoji': ''}, {'code': 'SO', 'name': 'Somalia', 'emoji': ''}, {'code': 'ZA', 'name': 'South Africa', 'emoji': ''}, {'code': 'GS', 'name': 'South Georgia and the South Sandwich Islands', 'emoji': ''}, {'code': 'SS', 'name': 'South Sudan', 'emoji': ''}, {'code': 'ES', 'name': 'Spain', 'emoji': ''}, {'code': 'LK', 'name': 'Sri Lanka', 'emoji': ''}, {'code': 'SD', 'name': 'Sudan', 'emoji': ''}, {'code': 'SR', 'name': 'Suriname', 'emoji': ''}, {'code': 'SJ', 'name': 'Svalbard and Jan Mayen', 'emoji': ''}, {'code': 'SE', 'name': 'Sweden', 'emoji': ''}, {'code': 'CH', 'name': 'Switzerland', 'emoji': ''}, {'code': 'SY', 'name': 'Syrian Arab Republic', 'emoji': ''}, {'code': 'TW', 'name': 'Taiwan, Province of China', 'emoji': ''}, {'code': 'TJ', 'name': 'Tajikistan', 'emoji': ''}, {'code': 'TZ', 'name': 'Tanzania, United Republic of', 'emoji': ''}, {'code': 'TH', 'name': 'Thailand', 'emoji': ''}, {'code': 'TL', 'name': 'Timor-Leste', 'emoji': ''}, {'code': 'TG', 'name': 'Togo', 'emoji': ''}, {'code': 'TK', 'name': 'Tokelau', 'emoji': ''}, {'code': 'TO', 'name': 'Tonga', 'emoji': ''}, {'code': 'TT', 'name': 'Trinidad and Tobago', 'emoji': ''}, {'code': 'TN', 'name': 'Tunisia', 'emoji': ''}, {'code': 'TM', 'name': 'Turkmenistan', 'emoji': ''}, {'code': 'TC', 'name': 'Turks and Caicos Islands', 'emoji': ''}, {'code': 'TV', 'name': 'Tuvalu', 'emoji': ''}, {'code': 'TR', 'name': 'Türkiye', 'emoji': ''}, {'code': 'UG', 'name': 'Uganda', 'emoji': ''}, {'code': 'UA', 'name': 'Ukraine', 'emoji': ''}, {'code': 'AE', 'name': 'United Arab Emirates', 'emoji': ''}, {'code': 'GB', 'name': 'United Kingdom', 'emoji': ''}, {'code': 'US', 'name': 'United States', 'emoji': ''}, {'code': 'UM', 'name': 'United States Minor Outlying Islands', 'emoji': ''}, {'code': 'UY', 'name': 'Uruguay', 'emoji': ''}, {'code': 'UZ', 'name': 'Uzbekistan', 'emoji': ''}, {'code': 'VU', 'name': 'Vanuatu', 'emoji': ''}, {'code': 'VE', 'name': 'Venezuela, Bolivarian Republic of', 'emoji': ''}, {'code': 'VN', 'name': 'Viet Nam', 'emoji': ''}, {'code': 'VG', 'name': 'Virgin Islands, British', 'emoji': ''}, {'code': 'VI', 'name': 'Virgin Islands, U.S.', 'emoji': ''}, {'code': 'WF', 'name': 'Wallis and Futuna', 'emoji': ''}, {'code': 'EH', 'name': 'Western Sahara', 'emoji': ''}, {'code': 'YE', 'name': 'Yemen', 'emoji': ''}, {'code': 'ZM', 'name': 'Zambia', 'emoji': ''}, {'code': 'ZW', 'name': 'Zimbabwe', 'emoji': ''}, {'code': 'AX', 'name': 'Åland Islands', 'emoji': ''}]
LOCATION_STATES_CACHE = {}
LOCATION_CITIES_CACHE = {}
JOBS_CACHE = None
JOBS_CACHE_AT = 0.0
JOBS_CACHE_TTL_SECONDS = 300


# --------------------------------------------------
# CORS
# --------------------------------------------------
# Configure allowed frontend origins via the CORS_ORIGINS env var
# (comma-separated), e.g. "https://myapp.vercel.app,https://myapp.com".
# Local dev origins are always included so `npm run dev` keeps working.

_default_dev_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
_configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
ALLOWED_ORIGINS = list(dict.fromkeys(_configured_origins + _default_dev_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Global error handling
# --------------------------------------------------
# Make sure unexpected errors never leak stack traces / internal details to
# the client in production - they get logged server-side and the client gets
# a clean, generic JSON error instead.

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    response = JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Something went wrong on our end. Please try again shortly.",
        },
    )

    origin = request.headers.get("origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response

# --------------------------------------------------
# Basic routes
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "AI Job Board backend is running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok"
    }


# --------------------------------------------------
# Supabase test
# --------------------------------------------------

@app.get("/api/supabase-test")
def supabase_test():
    response = (
        supabase
        .table("jobs")
        .select("*")
        .limit(1)
        .execute()
    )

    return {
        "connected": True,
        "data": response.data,
    }


# --------------------------------------------------
# User-facing skill catalog
# --------------------------------------------------

SKILL_CATALOG = {
    "Python": [
        "python",
        "python programming",
        "python programming language",
        "python for data science",
        "python/jupyter",
        "python pyspark",
        "python/pyspark",
    ],

    "SQL": [
        "sql",
        "sql server",
        "sql queries",
        "sql database",
        "sql databases",
        "structured query language",
        "mysql",
        "ms sql",
        "mssql",
    ],

    "Power BI": [
        "power bi",
        "powerbi",
        "power-bi",
        "pbi",
        "microsoft power bi",
        "ms power bi",
    ],

    "Tableau": [
        "tableau",
        "tableau desktop",
        "tableau server",
        "tableau prep",
        "tableu",
    ],

    "Excel": [
        "excel",
        "advanced excel",
        "advance excel",
        "microsoft excel",
        "ms excel",
        "ms-excel",
    ],

    "Python Data Libraries": [
        "pandas",
        "numpy",
        "scipy",
        "matplotlib",
        "seaborn",
    ],

    "Machine Learning": [
        "machine learning",
        "machine learning algorithms",
        "machine learning models",
        "machine learning techniques",
        "ml",
        "ml algorithms",
    ],

    "Deep Learning": [
        "deep learning",
        "deep learning techniques",
        "deep learning frameworks",
        "dl",
    ],

    "TensorFlow": [
        "tensorflow",
        "tensor flow",
        "tensor-flow",
    ],

    "PyTorch": [
        "pytorch",
        "py torch",
        "pytorch/keras",
    ],

    "Scikit-learn": [
        "scikit-learn",
        "scikit learn",
        "scikitlearn",
        "sklearn",
    ],

    "Java": [
        "java",
        "java 8",
        "java 11",
        "java 17",
        "java/j2ee",
        "core java",
    ],

    "JavaScript": [
        "javascript",
        "java script",
        "javascript es6",
        "javascript (es6+)",
        "ecmascript",
        "js",
    ],

    "TypeScript": [
        "typescript",
        "typescript/javascript",
    ],

    "React": [
        "react",
        "react js",
        "reactjs",
        "react.js",
        "react native",
        "react hooks",
    ],

    "Angular": [
        "angular",
        "angular js",
        "angular.js",
        "angularjs",
        "angular 2+",
    ],

    "Vue": [
        "vue",
        "vue js",
        "vue.js",
        "vuejs",
    ],

    "Node.js": [
        "node",
        "node js",
        "node.js",
        "nodejs",
    ],

    "C#": [
        "c#",
        "c#.net",
        "c-sharp",
        "c# .net core",
    ],

    ".NET": [
        ".net",
        ".net framework",
        ".net core",
        ".net 6",
        "dot net",
        "dot net core",
        "dotnet core",
    ],

    "C++": [
        "c++",
        "c/c++",
        "c++ programming",
    ],

    "PHP": [
        "php",
        "php laravel",
        "php (laravel)",
    ],

    "Django": [
        "django",
        "django framework",
    ],

    "Flask": [
        "flask",
        "flask framework",
    ],

    "FastAPI": [
        "fastapi",
        "fast api",
        "python fastapi",
    ],

    "Spring Boot": [
        "spring boot",
        "springboot",
        "spring boot framework",
        "java spring boot",
        "java springboot",
    ],

    "PostgreSQL": [
        "postgresql",
        "postgres",
        "postgresql.",
        "postgress",
        "postgre sql",
    ],

    "MySQL": [
        "mysql",
        "my sql",
        "my-sql",
    ],

    "MongoDB": [
        "mongodb",
        "mongo db",
        "mongo",
    ],

    "Redis": [
        "redis",
        "redis cache",
    ],

    "Apache Spark": [
        "spark",
        "apache spark",
        "spark sql",
        "spark streaming",
    ],

    "Hadoop": [
        "hadoop",
        "apache hadoop",
        "hadoop ecosystem",
    ],

    "Apache Kafka": [
        "kafka",
        "apache kafka",
        "kafka streaming",
    ],

    "Airflow": [
        "airflow",
        "apache airflow",
    ],

    "Docker": [
        "docker",
        "docker containers",
        "docker-container",
    ],

    "Kubernetes": [
        "kubernetes",
        "kubernetes operators",
        "k8s",
    ],

    "Git": [
        "git",
        "git/github",
        "git & github",
        "git version control system",
    ],

    "GitHub": [
        "github",
        "github actions",
        "github copilot",
    ],

    "GitLab": [
        "gitlab",
        "gitlab ci",
        "gitlab ci/cd",
    ],

    "Bitbucket": [
        "bitbucket",
    ],

    "AWS": [
        "aws",
        "amazon web services",
        "amazon web services (aws)",
        "aws cloud",
        "aws services",
    ],

    "Azure": [
        "azure",
        "microsoft azure",
        "azure cloud",
        "azure services",
    ],

    "GCP": [
        "gcp",
        "google cloud",
        "google cloud platform",
        "google cloud platform (gcp)",
    ],

    "Generative AI": [
        "generative ai",
        "gen ai",
        "genai",
        "gen-ai",
        "generative-ai",
    ],

    "LLM": [
        "llm",
        "llms",
        "large language models",
        "large language models (llm)",
    ],

    "NLP": [
        "nlp",
        "natural language processing",
        "natural language processing (nlp)",
    ],

    "Computer Vision": [
        "computer vision",
        "computer vision (cv)",
        "cv",
    ],

    "GitOps / CI-CD": [
        "ci/cd",
        "cicd",
        "ci/cd pipelines",
        "continuous integration",
        "continuous deployment",
    ],

    "REST API": [
        "rest",
        "rest api",
        "rest apis",
        "restful api",
        "restful apis",
        "restful services",
    ],

    "GraphQL": [
        "graphql",
        "graphql api",
        "graph ql",
    ],

    "Power Query": [
        "power query",
        "power query (m)",
    ],

    "PowerPoint": [
        "powerpoint",
        "power point",
        "ms powerpoint",
    ],

    "Git / Version Control": [
        "version control",
        "code versioning",
        "source control",
    ],
}


def catalog_skill_match(raw_skill: str) -> str | None:
    if not isinstance(raw_skill, str):
        return None

    value = " ".join(
        raw_skill.strip().lower().split()
    )

    if not value:
        return None

    ignored = {
        "not mentioned",
        '"not mentioned"',
        "not",
        "none",
        "n/a",
    }

    if value in ignored:
        return None

    for canonical, aliases in SKILL_CATALOG.items():
        for alias in aliases:
            alias_normalized = " ".join(
                alias.lower().split()
            )

            if value == alias_normalized:
                return canonical

    return None


def _job_posted_timestamp(job):
    raw = (
        job.get("posted_at")
        or job.get("date_posted")
        or job.get("published_at")
        or job.get("created_at")
        or job.get("updated_at")
    )

    if not raw:
        return None

    value = str(raw).strip()

    # Standard ISO timestamps, e.g.:
    # 2026-08-20T18:29:47.191857+00:00
    try:
        iso_value = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso_value)

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        return dt.timestamp()

    except (TypeError, ValueError):
        pass

    # Job-source format, e.g.:
    # 2025/8/13, 19:30
    # 2025/08/13, 19:30
    for fmt in (
        "%Y/%m/%d, %H:%M",
        "%Y/%m/%d, %H:%M:%S",
        "%Y/%-m/%-d, %H:%M",
        "%Y/%-m/%-d, %H:%M:%S",
    ):
        try:
            dt = datetime.strptime(value, fmt)
            dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except (TypeError, ValueError):
            continue

    return None


# --------------------------------------------------
# Generic location data
# --------------------------------------------------

@app.get("/api/locations/countries")
def get_location_countries():
    """Return a lightweight static country list immediately.

    Country options are independent of the jobs database so the UI does not
    need to scan Supabase just to open the location picker.
    """
    return {"countries": LOCATION_COUNTRIES_STATIC}


@app.get("/api/locations/{country_code}/states")
def get_location_states(country_code: str):
    """Load states only when a user expands a country."""
    code = country_code.strip().upper()
    if code in LOCATION_STATES_CACHE:
        return {"country_code": code, "states": LOCATION_STATES_CACHE[code]}

    try:
        from countrystatecity_countries import get_states_of_country
        states = get_states_of_country(code)
        values = [
            {"code": getattr(item, "iso2", ""), "name": getattr(item, "name", "")}
            for item in states
            if getattr(item, "name", None)
        ]
        values.sort(key=lambda item: item["name"].lower())
    except Exception:
        values = []

    LOCATION_STATES_CACHE[code] = values
    return {"country_code": code, "states": values}


@app.get("/api/locations/{country_code}/states/{state_code}/cities")
def get_location_cities(country_code: str, state_code: str):
    """Load cities only when a user expands a state."""
    country = country_code.strip().upper()
    state = state_code.strip().upper()
    key = f"{country}:{state}"
    if key in LOCATION_CITIES_CACHE:
        return {"country_code": country, "state_code": state, "cities": LOCATION_CITIES_CACHE[key]}

    try:
        from countrystatecity_countries import get_cities_of_state
        cities = get_cities_of_state(country, state)
        values = [
            {"id": getattr(item, "id", None), "name": getattr(item, "name", "")}
            for item in cities
            if getattr(item, "name", None)
        ]
        values.sort(key=lambda item: item["name"].lower())
    except Exception:
        values = []

    LOCATION_CITIES_CACHE[key] = values
    return {"country_code": country, "state_code": state, "cities": values}


# --------------------------------------------------
# Job listing
# --------------------------------------------------

def _clean_role_title(value):
    if not isinstance(value, str):
        return None
    text = " ".join(value.strip().split())
    if not text:
        return None
    # Strip accidental list/prefix punctuation without damaging real titles
    # such as .NET.
    text = re.sub(r"^(?:[-:|]+\s*)+", "", text)
    # Drop noisy trailing experience annotations from role metadata.
    text = re.sub(r"\s*\(\s*\d+\s*(?:years?|yrs?)\s*\)\s*$", "", text, flags=re.I)
    text = text.strip()
    return text or None


def _fetch_all_job_rows():
    """Fetch the full public job pool in small stable batches.

    The previous version requested the full ``*`` row payload, which can be
    unnecessarily large and can fail through the API gateway. We first inspect
    one row to discover the available columns, then request only the fields
    actually used by the UI/recommendation features.
    """
    global JOBS_CACHE, JOBS_CACHE_AT
    now = time.time()
    if JOBS_CACHE is not None and (now - JOBS_CACHE_AT) < JOBS_CACHE_TTL_SECONDS:
        return JOBS_CACHE

    # Discover the actual schema so a newly added/removed optional column
    # cannot break the whole jobs endpoint.
    sample = supabase.table("jobs").select("*").limit(1).execute()
    sample_rows = sample.data or []
    if not sample_rows:
        JOBS_CACHE = []
        JOBS_CACHE_AT = now
        return JOBS_CACHE

    available = set(sample_rows[0].keys())
    desired = [
        "job_id", "title", "company_name", "location", "source", "skills",
        "roles", "min_experience", "max_experience", "domain",
        "employment_type", "thumbnail", "ai_skills", "ai_roles", "ai_tags",
        "ai_min_experience", "ai_max_experience", "ai_enriched", "created_at",
        "updated_at", "posted_at", "date_posted", "published_at",
    ]
    fields = [field for field in desired if field in available]
    if "job_id" not in fields:
        fields = list(available)

    rows = []
    start = 0
    batch_size = 500
    field_string = ",".join(fields)
    while True:
        query = (
            supabase
            .table("jobs")
            .select(field_string)
            .order("job_id")
            .range(start, start + batch_size - 1)
        )
        batch = None
        last_exc = None
        for attempt in range(3):
            try:
                response = query.execute()
                batch = response.data or []
                last_exc = None
                break
            except Exception as exc:
                last_exc = exc
                time.sleep(0.5 * (attempt + 1))

        if last_exc is not None:
            if JOBS_CACHE is not None:
                return JOBS_CACHE
            raise last_exc
        
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < batch_size:
            break
        start += batch_size

    JOBS_CACHE = rows
    JOBS_CACHE_AT = now
    return rows


PUBLIC_JOB_FIELDS = {
    "job_id", "title", "company_name", "location", "source", "skills", "roles",
    "min_experience", "max_experience", "domain", "employment_type", "thumbnail",
    "ai_skills", "ai_roles", "ai_tags", "ai_min_experience", "ai_max_experience",
    "ai_enriched", "created_at", "updated_at", "posted_at", "date_posted", "published_at",
}


def _public_job(job):
    return {k: job.get(k) for k in PUBLIC_JOB_FIELDS if k in job}


@app.get("/api/jobs")
def get_jobs(
    search: str | None = Query(default=None),
    source: str | None = Query(default=None),
    skill: list[str] | None = Query(default=None),
    location: list[str] | None = Query(default=None),
    domain: list[str] | None = Query(default=None),
    experience: str | None = Query(default=None),
    posted_window: str | None = Query(default=None),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
):

    # Fast path: when no filters/search are active, let Supabase
    # paginate the jobs directly instead of loading the full dataset.
    has_filters = bool(
        search
        or source
        or skill
        or location
        or domain
        or experience
        or posted_window
    )

    if not has_filters:
        response = (
            supabase
            .table("jobs")
        .select(
            "job_id,title,company_name,location,source,skills,roles,"
            "min_experience,max_experience,domain,employment_type,"
            "thumbnail,ai_skills,ai_roles,ai_tags,ai_min_experience,"
            "ai_max_experience,ai_enriched,created_at,posted_at",
            count="exact",
        )
            .order("job_id")
            .range(offset, offset + limit - 1)
            .execute()
        )

        page = response.data or []
        total_all = response.count or 0

        return {
            "count": len(page),
            "total": total_all,
            "total_all": total_all,
            "offset": offset,
            "limit": limit,
            "has_more": offset + len(page) < total_all,
            "jobs": [_public_job(job) for job in page],
        }
    # Fast path: source-only filtering.
    if (
        source
        and not search
        and not skill
        and not location
        and not domain
        and not experience
        and not posted_window
    ):
        response = (
            supabase
            .table("jobs")
            .select(
                "job_id,title,company_name,location,source,skills,roles,"
                "min_experience,max_experience,domain,employment_type,"
                "thumbnail,ai_skills,ai_roles,ai_tags,ai_min_experience,"
                "ai_max_experience,ai_enriched,created_at,posted_at",
                count="exact",
            )
            .eq("source", source.strip())
            .order("job_id")
            .range(offset, offset + limit - 1)
            .execute()
        )

        page = response.data or []
        total = response.count or 0

        return {
            "count": len(page),
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": offset + len(page) < total,
            "jobs": [_public_job(job) for job in page],
        }
    # Fast path: source + country-level location.
    if (
        source
        and location
        and not search
        and not skill
        and not domain
        and not experience
        and not posted_window
    ):
        selected_country = None

        for value in location:
            if not isinstance(value, str):
                continue

            value = value.strip()
            parts = value.split("|", 2)

            if len(parts) == 3 and parts[0].lower() == "country":
                selected_country = parts[2].strip()
                break

            if value:
                selected_country = value
                break

        if selected_country:
            response = (
                supabase
                .table("jobs")
                .select(
                    "job_id,title,company_name,location,source,skills,roles,"
                    "min_experience,max_experience,domain,employment_type,"
                    "thumbnail,ai_skills,ai_roles,ai_tags,ai_min_experience,"
                    "ai_max_experience,ai_enriched,created_at,posted_at"
                )
                .eq("source", source.strip())
                .eq("country", selected_country)
                .order("job_id")
                .range(offset, offset + limit)
                .execute()
            )

            fetched_jobs = response.data or []

            # Fetch one extra row to determine whether another page exists.
            has_more = len(fetched_jobs) > limit
            page = fetched_jobs[:limit]

            return {
                "count": len(page),
                "total": None,
                "total_all": None,
                "offset": offset,
                "limit": limit,
                "has_more": has_more,
                "jobs": [_public_job(job) for job in page],
            }

    # Fast path: country-only location.
    if (
        location
        and not source
        and not search
        and not skill
        and not domain
        and not experience
        and not posted_window
    ):
        selected_country = None

        for value in location:
            if not isinstance(value, str):
                continue

            value = value.strip()
            parts = value.split("|", 2)

            if len(parts) == 3 and parts[0].lower() == "country":
                selected_country = parts[2].strip()
                break

            if value:
                selected_country = value
                break

        if selected_country:
            response = (
                supabase
                .table("jobs")
                .select(
                    "job_id,title,company_name,location,source,skills,roles,"
                    "min_experience,max_experience,domain,employment_type,"
                    "thumbnail,ai_skills,ai_roles,ai_tags,ai_min_experience,"
                    "ai_max_experience,ai_enriched,created_at,posted_at"
                )
                .eq("country", selected_country)
                .order("job_id")
                .range(offset, offset + limit)
                .execute()
            )
            fetched_jobs = response.data or []
            has_more = len(fetched_jobs) > limit
            page = fetched_jobs[:limit]
            return {
                "count": len(page),
                "total": None,
                "total_all": None,
                "offset": offset,
                "limit": limit,
                "has_more": has_more,
                "jobs": [_public_job(job) for job in page],
            }
    # Fast path: domain-only filtering.
    if (
        domain
        and not source
        and not search
        and not skill
        and not location
        and not experience
        and not posted_window
    ):
        selected_domain = None

        for value in domain:
            if isinstance(value, str) and value.strip():
                selected_domain = value.strip()
                break

        if selected_domain:
            response = (
                supabase
                .table("jobs")
                .select(
                    "job_id,title,company_name,location,source,skills,roles,"
                    "min_experience,max_experience,domain,employment_type,"
                    "thumbnail,ai_skills,ai_roles,ai_tags,ai_min_experience,"
                    "ai_max_experience,ai_enriched,created_at,posted_at"
                )
                .eq("domain", selected_domain)
                .order("job_id")
                .range(offset, offset + limit)
                .execute()
            )

            fetched_jobs = response.data or []
            has_more = len(fetched_jobs) > limit
            page = fetched_jobs[:limit]

            return {
                "count": len(page),
                "total": None,
                "total_all": None,
                "offset": offset,
                "limit": limit,
                "has_more": has_more,
                "jobs": [_public_job(job) for job in page],
            }
    # Existing filtered-search logic continues below.
    jobs = list(_fetch_all_job_rows())
    total_all = len(jobs)
    # -----------------------------------------
    # Source filter (single select)
    # -----------------------------------------
    if source:
        source_value = source.strip().lower()

        jobs = [
            job
            for job in jobs
            if (job.get("source") or "").strip().lower()
            == source_value
        ]

    # -----------------------------------------
    # Keyword search
    # -----------------------------------------

    if search:
        search_value = search.strip().lower()

        if search_value:
            searchable_jobs = []

            for job in jobs:
                title = (job.get("title") or "").lower()
                company = (job.get("company_name") or "").lower()
                skills_text = (job.get("skills") or "").lower()

                ai_skills_text = " ".join(
                    str(value).lower()
                    for value in (job.get("ai_skills") or [])
                )

                if (
                    search_value in title
                    or search_value in company
                    or search_value in skills_text
                    or search_value in ai_skills_text
                ):
                    searchable_jobs.append(job)

            jobs = searchable_jobs

    # -----------------------------------------
    # Clean selected filters
    # -----------------------------------------

    selected_skills = {
        value.strip().lower()
        for value in (skill or [])
        if isinstance(value, str) and value.strip()
    }

    selected_locations = set()

    for value in (location or []):
        if not isinstance(value, str):
            continue

        value = value.strip()

        if not value or value.lower() == "anywhere":
            continue

        # Frontend sends structured locations such as:
        # country|BD|Bangladesh
        # state|MH|Maharashtra
        # city|Pune|Pune
        #
        # Keep the user-visible name for matching.
        parts = value.split("|", 2)

        if len(parts) == 3:
            location_type, location_code, location_name = parts

            if location_type.lower() in {"country", "state", "city"}:
                selected_locations.add(location_name.strip().lower())
                continue

        # Backward compatibility for plain values.
        selected_locations.add(value.lower())

    selected_domains = {
        value.strip().lower()
        for value in (domain or [])
        if isinstance(value, str) and value.strip()
    }

    # -----------------------------------------
    # Apply multi-select filters
    #
    # OR within a filter group.
    # AND between filter groups.
    # -----------------------------------------

    filtered_jobs = []

    for job in jobs:

        # -----------------------------------------
        # Skills
        # -----------------------------------------

        if selected_skills:
            raw_skills = (job.get("skills") or "").lower()

            ai_skills = job.get("ai_skills") or []

            ai_skill_text = " ".join(
                str(value).lower()
                for value in ai_skills
            )

            combined_skill_text = (
                raw_skills
                + " "
                + ai_skill_text
            )

            skill_match = any(
                selected_skill in combined_skill_text
                for selected_skill in selected_skills
            )

            if not skill_match:
                continue

        # -----------------------------------------
        # Locations
        # -----------------------------------------

        if selected_locations:

            job_location = normalize_location(
                job.get("location")
            )

            if not job_location:
                continue

            # Normalize the complete location and its city.
            # Example:
            #   "Pune, Maharashtra" -> city "pune"
            #   "Pune, Maharashtra (+2 others)" -> city "pune"
            normalized_job_location = job_location.strip().lower()
            job_city = normalized_job_location.split(",", 1)[0].strip()

            location_match = False

            for selected_location in selected_locations:
                selected_location = selected_location.strip().lower()

                if not selected_location:
                    continue

                if selected_location in {"remote", "work from home", "wfh"}:
                    employment = str(job.get("employment_type") or "").lower()
                    raw_location = str(job.get("location") or "").lower()
                    if "remote" in employment or "remote" in raw_location or "work from home" in employment or "wfh" in employment:
                        location_match = True
                        break
                    continue

                selected_city = selected_location.split(",", 1)[0].strip()

                # Country-level selection, e.g. "India", "Canada", "United States"
                country_names = {
                    str(country.get("name", "")).strip().lower()
                    for country in LOCATION_COUNTRIES_STATIC
                    if country.get("name")
                }

                if selected_location in country_names:
                    if _country_matches_job_location(
                        selected_location,
                        normalized_job_location,
                    ):
                        location_match = True
                        break
                    continue

                # Existing city/full-location matching
                if (
                    selected_location == normalized_job_location
                    or selected_city == job_city
                ):
                    location_match = True
                    break

            if not location_match:
                continue

        # -----------------------------------------
        # Domains
        # -----------------------------------------

        if selected_domains:
            job_domain = (
                job.get("domain") or ""
            ).strip().lower()

            # Be tolerant of harmless formatting differences such as
            # "DataScience" vs "Data Science".
            normalized_job_domain = "".join(
                job_domain.split()
            )

            domain_match = False

            for selected_domain in selected_domains:
                normalized_selected_domain = "".join(
                    selected_domain.strip().lower().split()
                )

                if (
                    normalized_selected_domain
                    == normalized_job_domain
                ):
                    domain_match = True
                    break

            if not domain_match:
                continue

        # -----------------------------------------
        # Experience filter
        # -----------------------------------------

        if experience:
            exp_value = experience.strip().lower()

            min_exp = job.get("ai_min_experience")
            max_exp = job.get("ai_max_experience")
            if min_exp is None:
                min_exp = job.get("min_experience")
            if max_exp is None:
                max_exp = job.get("max_experience")

            try:
                min_exp_num = float(min_exp) if min_exp is not None else None
            except (TypeError, ValueError):
                min_exp_num = None
            try:
                max_exp_num = float(max_exp) if max_exp is not None else None
            except (TypeError, ValueError):
                max_exp_num = None

            exp_match = True
            if exp_value == "fresher":
                exp_match = (min_exp_num is None or min_exp_num <= 0) and (max_exp_num is None or max_exp_num <= 1)
            elif "-" in exp_value:
                low_s, high_s = exp_value.split("-", 1)
                low, high = float(low_s), float(high_s)
                exp_match = (min_exp_num is None or min_exp_num <= high) and (max_exp_num is None or max_exp_num >= low)
            elif exp_value == "5+":
                exp_match = (max_exp_num is None and min_exp_num is None) or (max_exp_num is None or max_exp_num >= 5)

            if not exp_match:
                continue

        # Posted-window filter (24h / 7d / 30d). If the dataset does not
        # contain a parseable posting timestamp, the job is excluded only
        # when a posted-window filter is explicitly requested.
        if posted_window:
            posted_ts = _job_posted_timestamp(job)
            if posted_ts is None:
                continue
            window_days = {"24h": 1/24, "7d": 7, "30d": 30}.get(posted_window)
            if window_days is None:
                raise HTTPException(status_code=400, detail="Invalid posted_window")
            if posted_ts < (time.time() - window_days * 86400):
                continue

        filtered_jobs.append(job)

    total = len(filtered_jobs)
    page = filtered_jobs[offset: offset + limit]
    return {
        "count": len(page),
        "total": total,
        "total_all": total_all,
        "offset": offset,
        "limit": limit,
        "has_more": offset + len(page) < total,
        "jobs": [_public_job(job) for job in page],
    }


# --------------------------------------------------
# Location normalization
# --------------------------------------------------

def normalize_location(
    location: str
) -> str | None:

    if not isinstance(
        location,
        str
    ):
        return None

    location = " ".join(
        location.strip().split()
    )

    if not location:
        return None

    # Convert:
    # Bengaluru, Karnataka (+1 other)
    # Pune, Maharashtra (+2 others)
    # Bangladesh (+14 others)
    #
    # into:
    # Bengaluru, Karnataka
    # Pune, Maharashtra
    # Bangladesh

    location = (
        location
        .split(" (+", 1)[0]
        .strip()
    )

    if location.startswith("(+"):
        return None

    if not location:
        return None

    return location

def _country_matches_job_location(
    selected_country: str,
    job_location: str,
) -> bool:
    """
    Return True when a job location belongs to the selected country.

    Handles:
      "India" -> "Pune, Maharashtra"
      "India" -> "Mumbai, Maharashtra"
      "Canada" -> "Toronto, ON, Canada"
      "United Kingdom" -> "London, UK"
    """

    if not selected_country or not job_location:
        return False

    selected_country = selected_country.strip().lower()
    parts = [
        part.strip().lower()
        for part in job_location.split(",")
        if part.strip()
    ]

    # Direct country match, e.g.:
    # "New York, NY, United States"
    if selected_country in parts:
        return True

    # Find the ISO code for the selected country.
    country_code = None

    for country in LOCATION_COUNTRIES_STATIC:
        if (
            str(country.get("name", "")).strip().lower()
            == selected_country
        ):
            country_code = country.get("code")
            break

    if not country_code:
        return False

    # For locations such as:
    # "Pune, Maharashtra"
    # the database does not store "India", so infer the country
    # from the state/region.
    try:
        from countrystatecity_countries import get_states_of_country

        states = get_states_of_country(country_code)

        state_names = {
            str(getattr(state, "name", "")).strip().lower()
            for state in states
            if getattr(state, "name", None)
        }

        state_codes = {
            str(getattr(state, "iso2", "")).strip().lower()
            for state in states
            if getattr(state, "iso2", None)
        }

        # Check every location component after the city.
        for part in parts[1:]:
            if part in state_names or part in state_codes:
                return True

    except Exception:
        pass

    return False

# --------------------------------------------------
# Country job counts
# --------------------------------------------------

@app.get("/api/jobs/country-counts")
def get_country_counts():
    """
    Return country-level job counts.

    Builds the state -> country mapping once, then scans the job
    dataset only once.
    """
    jobs = _fetch_all_job_rows()

    # Build state/region -> country mapping once.
    state_to_country = {}

    try:
        from countrystatecity_countries import get_states_of_country

        for country in LOCATION_COUNTRIES_STATIC:
            country_code = country.get("code")
            country_name = country.get("name")

            if not country_code or not country_name:
                continue

            try:
                states = get_states_of_country(country_code)

                for state in states:
                    state_name = str(
                        getattr(state, "name", "")
                    ).strip().lower()

                    state_code = str(
                        getattr(state, "iso2", "")
                    ).strip().lower()

                    if state_name:
                        state_to_country[state_name] = country_name

                    if state_code:
                        state_to_country[state_code] = country_name

            except Exception:
                continue

    except Exception:
        state_to_country = {}

    counts = {}

    for job in jobs:
        location = normalize_location(job.get("location"))

        if not location:
            continue

        location_lower = location.strip().lower()

        # Direct country value.
        direct_country = next(
            (
                country["name"]
                for country in LOCATION_COUNTRIES_STATIC
                if country["name"].strip().lower() == location_lower
            ),
            None,
        )

        if direct_country:
            counts[direct_country] = (
                counts.get(direct_country, 0) + 1
            )
            continue

        # Explicit country in the location string.
        matched_country = None

        for country in LOCATION_COUNTRIES_STATIC:
            country_name = country["name"].strip().lower()

            if country_name in location_lower:
                matched_country = country["name"]
                break

        if matched_country:
            counts[matched_country] = (
                counts.get(matched_country, 0) + 1
            )
            continue

        # Infer country from state/region.
        parts = [
            part.strip().lower()
            for part in location.split(",")
            if part.strip()
        ]

        for part in parts[1:]:
            country_name = state_to_country.get(part)

            if country_name:
                counts[country_name] = (
                    counts.get(country_name, 0) + 1
                )
                break

    return {
        "countries": sorted(
            [
                {
                    "country": country,
                    "jobs": count,
                }
                for country, count in counts.items()
            ],
            key=lambda item: item["jobs"],
            reverse=True,
        )
    }
# --------------------------------------------------
# Job filter options
# Reads the full jobs table in batches
# --------------------------------------------------

@app.get("/api/jobs/filter-options")
def get_filter_options():
    """
    Return the values used by the frontend filter dropdowns.

    The result is cached in memory after a successful build so the
    database is not scanned on every page load.
    """
    global FILTER_OPTIONS_CACHE

    if FILTER_OPTIONS_CACHE is not None:
        return FILTER_OPTIONS_CACHE

    jobs = _fetch_all_job_rows()
    if jobs:
        # Build filter options from the existing cached job pool.
        source_values = set()
        location_values = set()
        domain_values = set()
        skill_values = set()
        role_values = set()
        locations_by_state = {}

        for job in jobs:
            title = _clean_role_title(job.get("title"))
            if title and len(title) <= 90:
                role_values.add(title)

            source = job.get("source")
            if isinstance(source, str) and source.strip():
                source_values.add(source.strip())

            location = normalize_location(job.get("location"))
            if location:
                location_values.add(location)

            domain = job.get("domain")
            if isinstance(domain, str) and domain.strip():
                domain_values.add(domain.strip())

            raw_skills = job.get("skills") or ""
            if isinstance(raw_skills, str):
                for raw_skill in raw_skills.split(","):
                    canonical = catalog_skill_match(raw_skill)
                    if canonical:
                        skill_values.add(canonical)

            ai_skills = job.get("ai_skills") or []
            if isinstance(ai_skills, list):
                for raw_skill in ai_skills:
                    canonical = catalog_skill_match(raw_skill)
                    if canonical:
                        skill_values.add(canonical)

        FILTER_OPTIONS_CACHE = {
            "sources": sorted(source_values, key=str.lower),
            "locations": sorted(location_values, key=str.lower),
            "skills": sorted(skill_values, key=str.lower),
            "domains": sorted(domain_values, key=str.lower),
            "roleTitles": sorted(role_values, key=str.lower),
            "locationsByState": {
                state: sorted(cities, key=str.lower)
                for state, cities in locations_by_state.items()
            },
        }
        return FILTER_OPTIONS_CACHE

    batch_size = 1000
    start = 0

    sources = set()
    locations = set()
    domains = set()
    matched_skills = set()
    role_titles = set()

    # Location hierarchy used by the frontend:
    # State/region -> cities
    #
    # Examples:
    #   "Pune, Maharashtra" -> Maharashtra -> Pune
    #   "Mumbai, Maharashtra" -> Maharashtra -> Mumbai
    #   "New York, NY, United States" -> NY -> New York
    locations_by_state = {}

    try:
        while True:
            query = (
                supabase
                .table("jobs")
                .select("title,roles,ai_roles,source,skills,ai_skills,location,domain")
                .range(start, start + batch_size - 1)
            )

            jobs = None
            last_exc = None
            for attempt in range(3):
                try:
                    response = query.execute()
                    jobs = response.data or []
                    last_exc = None
                    break
                except Exception as exc:
                    last_exc = exc
                    time.sleep(0.5 * (attempt + 1))

            if last_exc is not None:
                raise last_exc        

            if not jobs:
                break

            for job in jobs:
                title = job.get("title")

                # Use real job titles for the top role selector. Do not mix in
                # noisy role metadata such as "--Backend Developer (4 years)"
                # or skill-like values from auxiliary role fields.
                clean_title = _clean_role_title(title)
                if clean_title and len(clean_title) <= 90:
                    role_titles.add(clean_title)

                # Source
                source = job.get("source")
                if isinstance(source, str):
                    source = source.strip()
                    if source:
                        sources.add(source)

                # Location
                location = normalize_location(job.get("location"))
                if location:
                    locations.add(location)

                    # Build State/Region -> City hierarchy.
                    # The existing normalized location format starts
                    # with the city and normally has the state/region
                    # after the first comma.
                    location_parts = [
                        part.strip()
                        for part in location.split(",")
                        if part.strip()
                    ]

                    if location_parts:
                        city = location_parts[0]

                        if len(location_parts) >= 2:
                            state = location_parts[1]
                        else:
                            # For locations that contain only a city
                            # or country, keep them under "Other".
                            state = "Other"

                        if state.lower() != "anywhere":
                            locations_by_state.setdefault(
                                state,
                                set()
                            ).add(city)

                # Domain
                domain = job.get("domain")
                if isinstance(domain, str):
                    domain = domain.strip()
                    if domain:
                        # Keep the real database value for the dropdown.
                        domains.add(domain)

                # Original skills
                raw_skills = job.get("skills") or ""
                if isinstance(raw_skills, str):
                    for raw_skill in raw_skills.split(","):
                        canonical = catalog_skill_match(raw_skill)
                        if canonical:
                            matched_skills.add(canonical)

                # AI skills
                ai_skills = job.get("ai_skills") or []
                if isinstance(ai_skills, list):
                    for raw_skill in ai_skills:
                        canonical = catalog_skill_match(raw_skill)
                        if canonical:
                            matched_skills.add(canonical)

            if len(jobs) < batch_size:
                break

            start += batch_size

        # IMPORTANT:
        # Only cache after the entire operation succeeds.
        # If Supabase fails, the exception is returned to FastAPI instead
        # of silently caching an empty dropdown response.
        # Convert the internal sets into JSON-friendly, sorted data.
        sorted_locations_by_state = {
            state: sorted(
                cities,
                key=str.lower
            )
            for state, cities in sorted(
                locations_by_state.items(),
                key=lambda item: item[0].lower()
            )
        }

        FILTER_OPTIONS_CACHE = {
            "sources": sorted(sources, key=str.lower),
            "skills": sorted(matched_skills, key=str.lower),

            # Keep the original flat locations list for compatibility
            # with any existing frontend code.
            "locations": sorted(
                locations,
                key=str.lower
            ),

            # New hierarchical location data for:
            # State -> City
            "locations_by_state": sorted_locations_by_state,

            "domains": sorted(domains, key=str.lower),
            "role_titles": sorted(role_titles, key=str.lower),
        }

        return FILTER_OPTIONS_CACHE

    except Exception as error:
        # Do not turn a backend failure into a fake successful response
        # containing empty arrays. The frontend can then show the real
        # backend error in the browser console.
        print("FILTER OPTIONS ERROR:", repr(error))
        raise


# --------------------------------------------------
# Single job details
# --------------------------------------------------

@app.get("/api/jobs/{job_id}")
def get_job(
    job_id: str
):
    try:
        response = (
            supabase
            .table("jobs")
            .select("*")
            .eq(
                "job_id",
                job_id
            )
            .single()
            .execute()
        )
    except Exception:
        # supabase-py's .single() raises when zero or multiple rows match,
        # which for this endpoint always means "no such job".
        raise HTTPException(status_code=404, detail={"message": "Job not found."})

    if not response.data:
        raise HTTPException(status_code=404, detail={"message": "Job not found."})

    return response.data


# --------------------------------------------------
# Resume upload + PDF extraction
# --------------------------------------------------

MAX_RESUME_BYTES = 8 * 1024 * 1024  # 8 MB


@app.post("/api/resume/upload")
async def upload_resume(
    file: UploadFile = File(...)
):

    if file.content_type != "application/pdf":
        return {
            "success": False,
            "message": (
                "Only PDF files are supported."
            ),
        }

    file_bytes = await file.read()

    if len(file_bytes) > MAX_RESUME_BYTES:
        return {
            "success": False,
            "message": "That PDF is too large. Please upload a resume under 8 MB.",
        }

    if not file_bytes:
        return {
            "success": False,
            "message": "The uploaded file is empty.",
        }

    from io import BytesIO
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        pdf = PdfReader(
            BytesIO(file_bytes)
        )

        text = ""

        for page in pdf.pages:

            extracted = page.extract_text()

            if extracted:
                text += (
                    extracted
                    + "\n"
                )
    except PdfReadError:
        return {
            "success": False,
            "message": "We couldn't read that PDF. It may be corrupted, password-protected, or scanned as images without a text layer.",
        }

    if not text.strip():
        return {
            "success": False,
            "message": "No readable text was found in this PDF. If it's a scanned document, try uploading a text-based resume instead.",
        }

    return {
        "success": True,
        "filename": file.filename,
        "pages": len(pdf.pages),
        "text_length": len(text),
        "text": text,
    }


# --------------------------------------------------
# Basic resume profile
# --------------------------------------------------

class ResumeProfileRequest(
    BaseModel
):
    resume_text: str


@app.post("/api/resume/profile")
def create_resume_profile(
    request: ResumeProfileRequest
):

    text = request.resume_text

    return {
        "success": True,
        "profile": {
            "skills": [],
            "roles": [],
            "experience_years": None,
            "education": [],
            "summary": text[:500],
        },
    }


# --------------------------------------------------
# Gemini resume analysis
# --------------------------------------------------

class ResumeAnalyzeRequest(
    BaseModel
):
    resume_text: str
    gemini_api_key: str


@app.post("/api/resume/analyze")
def analyze_resume(
    request: ResumeAnalyzeRequest
):

    if not request.gemini_api_key.strip():
        return {
            "success": False,
            "message": (
                "Gemini API key is required "
                "for AI analysis."
            ),
        }

    if not request.resume_text.strip():
        return {
            "success": False,
            "message": "Resume text is empty. Please upload a resume first.",
        }

    try:
        client = genai.Client(
            api_key=request.gemini_api_key
        )

        prompt = f"""
Analyze the following resume and return ONLY valid JSON.

Resume:
{request.resume_text}

Return exactly this structure:

{{
  "skills": [],
  "roles": [],
  "experience_years": null,
  "technical_experience": [],
  "education": [],
  "summary": ""
}}

Rules:
- skills: technical and professional skills clearly found in the resume
- roles: suitable job roles based on the resume
- experience_years: overall professional experience as a number when clearly stated
- technical_experience: relevant technical projects, tools, and technical work
- education: degrees, fields, and certifications
- summary: concise candidate summary
"""

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
        )

        profile_text = (response.text or "").strip()
    except Exception as error:
        logger.warning("Gemini resume analysis failed: %s", error)
        return {
            "success": False,
            "message": "Gemini request failed. Check the API key and try again.",
        }

    try:
        profile = json.loads(
            profile_text
        )

    except json.JSONDecodeError:

        return {
            "success": False,
            "message": (
                "Gemini returned an invalid "
                "JSON profile."
            ),
            "raw_response": profile_text,
        }

    return {
        "success": True,
        "profile": profile,
    }


# --------------------------------------------------
# Job recommendations
# --------------------------------------------------

class JobRecommendationRequest(
    BaseModel
):
    profile: dict
    limit: int = 10


@app.post("/api/jobs/recommend")
def recommend_jobs(
    request: JobRecommendationRequest
):

    profile = request.profile

    profile_skills = {
        skill.strip().lower()
        for skill in profile.get(
            "skills",
            []
        )
        if isinstance(
            skill,
            str
        )
    }

    profile_roles = {
        role.strip().lower()
        for role in profile.get(
            "roles",
            []
        )
        if isinstance(
            role,
            str
        )
    }

    experience_years = profile.get(
        "experience_years"
    )

    # -----------------------------------------
    # Candidate pool
    # -----------------------------------------

    base_select = (
        "job_id,title,company_name,location,source,skills,roles,"
        "min_experience,max_experience,domain,employment_type,thumbnail,"
        "ai_skills,ai_roles,ai_tags,ai_min_experience,"
        "ai_max_experience,ai_enriched"
    )

    search_terms = list(
        profile_skills
        | profile_roles
    )

    # -----------------------------------------
    # Normal candidate jobs
    # -----------------------------------------

    normal_query = (
        supabase
        .table("jobs")
        .select(base_select)
    )

    if search_terms:

        or_conditions = []

        for term in search_terms[:20]:

            safe_term = (
                term
                .replace(",", " ")
                .replace("(", " ")
                .replace(")", " ")
                .strip()
            )

            if not safe_term:
                continue

            or_conditions.append(
                f"skills.ilike.%{safe_term}%"
            )

            or_conditions.append(
                f"roles.ilike.%{safe_term}%"
            )

            or_conditions.append(
                f"title.ilike.%{safe_term}%"
            )

        if or_conditions:

            normal_query = (
                normal_query
                .or_(
                    ",".join(
                        or_conditions
                    )
                )
            )

    normal_response = (
        normal_query
        .limit(500)
        .execute()
    )

    normal_jobs = (
        normal_response.data
        or []
    )

    # -----------------------------------------
    # Always include AI-enriched jobs
    # -----------------------------------------

    enriched_response = (
        supabase
        .table("jobs")
        .select(base_select)
        .eq(
            "ai_enriched",
            True
        )
        .execute()
    )

    enriched_jobs = (
        enriched_response.data
        or []
    )

    # -----------------------------------------
    # Merge and remove duplicates
    # -----------------------------------------

    job_map = {}

    for job in normal_jobs:
        job_map[
            job["job_id"]
        ] = job

    for job in enriched_jobs:
        job_map[
            job["job_id"]
        ] = job

    jobs = list(
        job_map.values()
    )

    # -----------------------------------------
    # Score jobs
    # -----------------------------------------

    recommendations = []

    for job in jobs:

        job_title = (
            job.get("title")
            or ""
        ).strip().lower()

        # -----------------------------------------
        # Use AI fields when available
        # -----------------------------------------

        if job.get(
            "ai_enriched"
        ):

            job_skills = {
                skill.strip().lower()
                for skill in (
                    job.get(
                        "ai_skills"
                    )
                    or []
                )
                if isinstance(
                    skill,
                    str
                )
                and skill.strip()
            }

            job_roles = {
                role.strip().lower()
                for role in (
                    job.get(
                        "ai_roles"
                    )
                    or []
                )
                if isinstance(
                    role,
                    str
                )
                and role.strip()
            }

        else:

            job_skills = {
                skill.strip().lower()
                for skill in (
                    job.get(
                        "skills"
                    )
                    or ""
                ).split(",")
                if skill.strip()
            }

            job_roles = {
                role.strip().lower()
                for role in (
                    job.get(
                        "roles"
                    )
                    or ""
                ).split(",")
                if role.strip()
            }

        # -----------------------------------------
        # 1. Skill match — 35 points
        # -----------------------------------------

        matched_skills = (
            profile_skills.intersection(
                job_skills
            )
        )

        skill_score = 0

        if profile_skills:

            skill_score = (
                len(
                    matched_skills
                )
                / len(
                    profile_skills
                )
            ) * 35

        # -----------------------------------------
        # 2. Role match — 25 points
        # -----------------------------------------

        matched_roles = set()

        for role in profile_roles:

            if role in job_title:
                matched_roles.add(
                    role
                )

        matched_roles.update(
            profile_roles.intersection(
                job_roles
            )
        )

        role_score = 0

        if profile_roles:

            role_score = (
                len(
                    matched_roles
                )
                / len(
                    profile_roles
                )
            ) * 25

        # -----------------------------------------
        # Title bonus — 10 points
        # -----------------------------------------

        title_bonus = 0

        for role in profile_roles:

            role_words = role.split()

            if all(
                word in job_title
                for word in role_words
            ):

                title_bonus = 10
                break

        # -----------------------------------------
        # 3. Experience fit — 20 points
        # -----------------------------------------

        experience_score = 0

        if job.get(
            "ai_enriched"
        ):

            min_exp = job.get(
                "ai_min_experience"
            )

            max_exp = job.get(
                "ai_max_experience"
            )

        else:

            min_exp = job.get(
                "min_experience"
            )

            max_exp = job.get(
                "max_experience"
            )

        if experience_years is not None:

            if (
                min_exp is not None
                and max_exp is not None
            ):

                if (
                    min_exp
                    <= experience_years
                    <= max_exp
                ):

                    experience_score = 20

                elif (
                    experience_years
                    >= min_exp
                ):

                    experience_score = 15

                elif (
                    experience_years
                    >= max(
                        0,
                        min_exp - 2
                    )
                ):

                    experience_score = 8

            elif min_exp is not None:

                if (
                    experience_years
                    >= min_exp
                ):

                    experience_score = 20

        # -----------------------------------------
        # 4. Domain match — 10 points
        # -----------------------------------------

        domain_score = 0

        job_domain = (
            job.get("domain")
            or ""
        ).strip().lower()

        if (
            "data" in job_domain
            and any(
                "data" in role
                for role in profile_roles
            )
        ):

            domain_score = 10

        # -----------------------------------------
        # Final score
        # -----------------------------------------

        total_score = (
            skill_score
            + role_score
            + title_bonus
            + experience_score
            + domain_score
        )

        recommendations.append(
            {
                **job,
                "match_score": round(
                    total_score,
                    2
                ),
                "matched_skills": sorted(
                    matched_skills
                ),
                "matched_roles": sorted(
                    matched_roles
                ),
                "score_breakdown": {
                    "skills": round(
                        skill_score,
                        2
                    ),
                    "role": round(
                        role_score,
                        2
                    ),
                    "title_bonus": title_bonus,
                    "experience": round(
                        experience_score,
                        2
                    ),
                    "domain": round(
                        domain_score,
                        2
                    ),
                },
            }
        )

    # -----------------------------------------
    # Sort
    # -----------------------------------------

    recommendations.sort(
        key=lambda job:
            job["match_score"],
        reverse=True,
    )

    return {
        "profile": profile,
        "recommendations": (
            recommendations[
                :request.limit
            ]
        ),
    }

# --------------------------------------------------
# AI Job Assistant
# --------------------------------------------------

class AssistantChatRequest(BaseModel):
    gemini_api_key: str
    message: str
    profile: dict | None = None
    job_id: str | None = None
    compare_job_ids: list[str] | None = None
    recommended_job_ids: list[str] | None = None
    filtered_job_ids: list[str] | None = None
    conversation: list[dict] | None = None
    context_mode: str | None = None


@app.post("/api/assistant/chat")
def assistant_chat(
    request: AssistantChatRequest
):
    api_key = request.gemini_api_key.strip()

    if not api_key:
        raise HTTPException(status_code=400, detail={"message": "Gemini API key is required."})

    message = request.message.strip()

    if not message:
        raise HTTPException(status_code=400, detail={"message": "Message cannot be empty."})

    client = genai.Client(
        api_key=api_key
    )

    profile = request.profile or {}

    selected_job = None
    comparison_jobs = []
    recommended_jobs = []
    filtered_jobs = []
    seen_job_ids = set()

    job_select = (
        "job_id,title,company_name,location,source,"
        "description,formatted_description,skills,roles,"
        "min_experience,max_experience,domain,"
        "employment_type,ai_skills,ai_roles,ai_tags,"
        "ai_min_experience,ai_max_experience,ai_enriched"
    )

    def unique_clean_ids(values, limit):
        result = []
        seen = set()
        for value in values or []:
            if isinstance(value, str) and value.strip() and value.strip() not in seen:
                seen.add(value.strip())
                result.append(value.strip())
                if len(result) >= limit:
                    break
        return result

    def fetch_jobs(ids):
        if not ids:
            return []
        response = (
            supabase
            .table("jobs")
            .select(job_select)
            .in_("job_id", ids)
            .execute()
        )
        by_id = {row.get("job_id"): row for row in (response.data or []) if isinstance(row, dict) and row.get("job_id")}
        return [by_id[job_id] for job_id in ids if job_id in by_id]

    # Selected job has highest priority for job-detail questions.
    if request.job_id:
        rows = fetch_jobs(unique_clean_ids([request.job_id], 1))
        selected_job = rows[0] if rows else None
        if selected_job:
            seen_job_ids.add(selected_job.get("job_id"))

    compare_ids = unique_clean_ids(request.compare_job_ids, 5)
    comparison_jobs = [row for row in fetch_jobs(compare_ids) if row.get("job_id") not in seen_job_ids]
    for row in comparison_jobs:
        seen_job_ids.add(row.get("job_id"))

    recommendation_ids = unique_clean_ids(request.recommended_job_ids, 6)
    recommended_jobs = fetch_jobs(recommendation_ids)
    for row in recommended_jobs:
        seen_job_ids.add(row.get("job_id"))

    filtered_ids = unique_clean_ids(request.filtered_job_ids, 20)
    filtered_jobs = [row for row in fetch_jobs(filtered_ids) if row.get("job_id") not in seen_job_ids]
    for row in filtered_jobs:
        seen_job_ids.add(row.get("job_id"))

    def compact_job(job):
        description = (job.get("formatted_description") or job.get("description") or "")
        if len(description) > 5000:
            description = description[:5000]
        return {
            "job_id": job.get("job_id"),
            "title": job.get("title"),
            "company_name": job.get("company_name"),
            "location": job.get("location"),
            "source": job.get("source"),
            "skills": job.get("skills"),
            "roles": job.get("roles"),
            "min_experience": job.get("min_experience"),
            "max_experience": job.get("max_experience"),
            "domain": job.get("domain"),
            "employment_type": job.get("employment_type"),
            "ai_skills": job.get("ai_skills"),
            "ai_roles": job.get("ai_roles"),
            "ai_tags": job.get("ai_tags"),
            "ai_min_experience": job.get("ai_min_experience"),
            "ai_max_experience": job.get("ai_max_experience"),
            "description": description,
        }

    job_context = {
        "selected_job": compact_job(selected_job) if selected_job else None,
        "comparison_jobs": [compact_job(row) for row in comparison_jobs],
        "recommended_jobs": [compact_job(row) for row in recommended_jobs],
        "filtered_jobs": [compact_job(row) for row in filtered_jobs],
    }

    history = []
    for item in (request.conversation or [])[-8:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
            history.append({"role": role, "content": content.strip()[:4000]})

    # -----------------------------------------
    # Gemini prompt
    # -----------------------------------------

    prompt = f"""
You are the conversational AI Job Assistant inside a job-search platform.

Use only the supplied context. Do not invent jobs, scores, skills, experience, companies, or locations.

Candidate profile:
{json.dumps(profile, ensure_ascii=False, indent=2)}

Job context (kept in separate groups intentionally):
{json.dumps(job_context, ensure_ascii=False, indent=2)}

Recent conversation:
{json.dumps(history, ensure_ascii=False, indent=2)}

User question:
{message}

Context mode hint: {request.context_mode or 'auto'}

Rules:
- If a selected_job exists, use it as the primary job for questions about suitability, missing skills, preparation, or explanation of the current job.
- If the user asks about "my recommended jobs", "my matches", "recommended", "personalized matches", or which job to apply for from their resume, rank ONLY the recommended_jobs group. Never introduce a job from filtered_jobs into that recommendation unless the user explicitly asks to include search results too.
- If the user explicitly refers to "these jobs", "current results", "visible jobs", a location/source/skill filter, or the current search, use the filtered_jobs group.
- For comparison questions, use the comparison_jobs group plus the explicitly requested groups.
- If the user asks for a general job-search question and no relevant job context is supplied, answer generally and say when information is unavailable.
- For suitability: compare profile skills/roles/experience against the selected job or requested job group.
- For missing skills: list concrete gaps and explain why they matter.
- For preparation: give practical, job-specific preparation steps.
- Keep the answer concise and easy to scan. Prefer 2–4 short headings followed by bullet points.
- Use plain Markdown only: headings must use "## Heading"; bullets must use "- item" on the same line as the item.
- Never output standalone "*" lines, "###", "####", horizontal rules, tables, or raw Markdown separator characters.
- Do not wrap every sentence in bold. Use bold only for short names, job titles, skills, or key labels.
- For suitability questions, structure the response as: Verdict, Matching skills, Gaps, Next steps.
- For recommendation questions, structure the response as: Best choice, Why, Main gaps, Alternatives.
"""

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
        )

        answer = (
            response.text
            or ""
        ).strip()

        if not answer:
            raise HTTPException(status_code=502, detail={"message": "Gemini returned an empty response."})

        all_jobs = []
        if selected_job:
            all_jobs.append(selected_job)
        all_jobs.extend(comparison_jobs)
        all_jobs.extend(recommended_jobs)
        all_jobs.extend(filtered_jobs)

        return {
            "success": True,
            "answer": answer,
            "job_ids": [
                job.get("job_id")
                for job in all_jobs
                if job.get("job_id")
            ],
        }

    except Exception as error:
        error_text = str(error)
        print(f"AI assistant Gemini error: {error_text}")
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Gemini request failed. Check the API key, model availability, and Gemini API access.",
                "error": error_text,
            },
        )
